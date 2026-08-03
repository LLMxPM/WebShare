// 文件功能描述：组装应用依赖，启动管理服务、分享网关和项目独立端口服务。
package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"webshare/internal/config"
	"webshare/internal/model"
	"webshare/internal/storage"
	"webshare/internal/store"
)

// App 保存应用运行时依赖和项目端口服务状态。
type App struct {
	cfg             config.Config
	store           *store.Store
	files           storage.Manager
	projectServers  map[int64]*http.Server
	runtimeWarnings map[int64][]string
	projectMu       sync.Mutex
}

// New 初始化数据库、文件目录和首次管理员账号。
func New(cfg config.Config) (*App, error) {
	if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
		return nil, err
	}
	db, err := store.Open(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	applySavedNetworkConfig(&cfg, db)
	app := &App{
		cfg:             cfg,
		store:           db,
		files:           storage.New(cfg.DataDir),
		projectServers:  map[int64]*http.Server{},
		runtimeWarnings: map[int64][]string{},
	}
	if err := app.ensureInitialAdmin(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return app, nil
}

// Start 启动全部 HTTP 服务，并在上下文取消时优雅退出。
func (a *App) Start(ctx context.Context) error {
	log.Printf("运行配置: dataDir=%s adminAddr=%s shareAddr=%s portRange=%d-%d", a.cfg.DataDir, a.cfg.AdminAddr, a.cfg.ShareAddr, a.cfg.PortStart, a.cfg.PortEnd)
	if err := a.startExistingProjectServers(); err != nil {
		return err
	}

	adminServer := &http.Server{Addr: a.cfg.AdminAddr, Handler: a.adminHandler(), ReadHeaderTimeout: 10 * time.Second}
	shareServer := &http.Server{Addr: a.cfg.ShareAddr, Handler: a.shareHandler(), ReadHeaderTimeout: 10 * time.Second}
	errCh := make(chan error, 2)

	go func() {
		log.Printf("管理服务已启动: %s", a.cfg.AdminAddr)
		if err := adminServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()
	go func() {
		log.Printf("分享网关已启动: %s", a.cfg.ShareAddr)
		if err := shareServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case <-ctx.Done():
		log.Print("正在关闭服务")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		_ = adminServer.Shutdown(shutdownCtx)
		_ = shareServer.Shutdown(shutdownCtx)
		a.stopAllProjectServers(shutdownCtx)
		if err := a.store.Close(); err != nil {
			log.Printf("关闭数据库失败: %v", err)
			return err
		}
		log.Print("服务已关闭")
		return nil
	case err := <-errCh:
		log.Printf("服务异常退出: %v", err)
		return err
	}
}

// startExistingProjectServers 为数据库中已分配独立端口的项目恢复监听。
func (a *App) startExistingProjectServers() error {
	projects, err := a.store.ListAllProjects()
	if err != nil {
		return err
	}
	for _, project := range projects {
		if project.Active && project.AccessMode == model.AccessPort && project.Port > 0 {
			if err := a.startProjectServer(project); err != nil {
				log.Printf("项目端口启动失败 project=%d port=%d err=%v", project.ID, project.Port, err)
				a.deactivateProjectAfterPortFailure(project, err)
			}
		}
	}
	return nil
}

// startProjectServer 为单个项目启动独立端口服务。
func (a *App) startProjectServer(project model.Project) error {
	a.projectMu.Lock()
	defer a.projectMu.Unlock()
	if existing := a.projectServers[project.ID]; existing != nil {
		_ = existing.Close()
		delete(a.projectServers, project.ID)
	}
	if !project.Active || project.AccessMode != model.AccessPort || project.Port <= 0 {
		return nil
	}
	addr := ":" + strconv.Itoa(project.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { a.serveProjectPort(project.ID, w, r) }),
		ReadHeaderTimeout: 10 * time.Second,
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	a.projectServers[project.ID] = server
	delete(a.runtimeWarnings, project.ID)
	go func() {
		log.Printf("项目独立端口已启动: project=%d port=%d", project.ID, project.Port)
		if err := server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("项目独立端口异常: project=%d err=%v", project.ID, err)
		}
	}()
	return nil
}

// deactivateProjectAfterPortFailure 在独立端口无法监听时停用项目并记录前端提示。
func (a *App) deactivateProjectAfterPortFailure(project model.Project, cause error) {
	project.Active = false
	if _, err := a.store.UpdateProjectSettings(project); err != nil {
		log.Printf("项目端口启动失败后停用项目失败 project=%d err=%v", project.ID, err)
		return
	}
	a.projectMu.Lock()
	a.runtimeWarnings[project.ID] = []string{fmt.Sprintf("项目独立端口 %d 启动失败，已自动停用。原因：%v", project.Port, cause)}
	a.projectMu.Unlock()
}

// projectServerRunning 判断指定项目当前是否有独立端口服务。
func (a *App) projectServerRunning(projectID int64) bool {
	a.projectMu.Lock()
	defer a.projectMu.Unlock()
	return a.projectServers[projectID] != nil
}

// stopProjectServer 停止单个项目独立端口服务。
func (a *App) stopProjectServer(projectID int64) {
	a.projectMu.Lock()
	defer a.projectMu.Unlock()
	if server := a.projectServers[projectID]; server != nil {
		_ = server.Close()
		delete(a.projectServers, projectID)
	}
}

// projectRuntimeWarnings 返回当前进程内记录的项目运行提示。
func (a *App) projectRuntimeWarnings(projectID int64) []string {
	a.projectMu.Lock()
	defer a.projectMu.Unlock()
	items := a.runtimeWarnings[projectID]
	return append([]string{}, items...)
}

// stopAllProjectServers 关闭所有项目独立端口服务。
func (a *App) stopAllProjectServers(ctx context.Context) {
	a.projectMu.Lock()
	defer a.projectMu.Unlock()
	for id, server := range a.projectServers {
		_ = server.Shutdown(ctx)
		delete(a.projectServers, id)
	}
}

// allocatePort 从端口池中寻找数据库未占用且系统可监听的端口。
func (a *App) allocatePort(projectID int64) (int, error) {
	for port := a.cfg.PortStart; port <= a.cfg.PortEnd; port++ {
		used, err := a.store.PortInUse(port, projectID)
		if err != nil || used {
			continue
		}
		if !portAvailable(port) {
			continue
		}
		return port, nil
	}
	return 0, fmt.Errorf("端口池 %d-%d 中没有可用端口", a.cfg.PortStart, a.cfg.PortEnd)
}

// ensureProjectPort 保证端口模式项目拥有唯一端口，必要时检查当前机器可监听。
func (a *App) ensureProjectPort(project *model.Project, checkAvailable bool) error {
	if project.Port == 0 {
		port, err := a.allocatePort(project.ID)
		if err != nil {
			return err
		}
		project.Port = port
		return nil
	}
	used, err := a.store.PortInUse(project.Port, project.ID)
	if err != nil {
		return err
	}
	if used {
		return fmt.Errorf("端口 %d 已被其他项目占用", project.Port)
	}
	if checkAvailable && !portAvailable(project.Port) {
		return fmt.Errorf("端口 %d 当前不可监听", project.Port)
	}
	return nil
}

// portAvailable 检查端口当前是否能被本进程监听。
func portAvailable(port int) bool {
	ln, err := net.Listen("tcp", ":"+strconv.Itoa(port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}
