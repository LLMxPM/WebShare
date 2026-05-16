// 文件功能描述：组装应用依赖，启动管理服务、分享网关和项目独立端口服务。
package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"static-host/internal/config"
	"static-host/internal/model"
	"static-host/internal/security"
	"static-host/internal/storage"
	"static-host/internal/store"
)

const (
	adminCredentialUserKey     = "desktop_admin_username"
	adminCredentialPasswordKey = "desktop_admin_password"
)

// App 保存应用运行时依赖和项目端口服务状态。
type App struct {
	cfg            config.Config
	store          *store.Store
	files          storage.Manager
	projectServers map[int64]*http.Server
	projectMu      sync.Mutex
}

// AdminCredential 是托盘菜单展示和重置管理员账号时返回的明文凭据。
type AdminCredential struct {
	Username         string
	Password         string
	PasswordRecorded bool
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
	app := &App{
		cfg:            cfg,
		store:          db,
		files:          storage.New(cfg.DataDir),
		projectServers: map[int64]*http.Server{},
	}
	if err := app.ensureInitialAdmin(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return app, nil
}

// Start 启动全部 HTTP 服务，并在上下文取消时优雅退出。
func (a *App) Start(ctx context.Context) error {
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
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		_ = adminServer.Shutdown(shutdownCtx)
		_ = shareServer.Shutdown(shutdownCtx)
		a.stopAllProjectServers(shutdownCtx)
		return a.store.Close()
	case err := <-errCh:
		return err
	}
}

// ensureInitialAdmin 在空库首次启动时创建管理员；未给密码时生成一次性密码。
func (a *App) ensureInitialAdmin() error {
	count, err := a.store.UserCount()
	if err != nil || count > 0 {
		return err
	}
	password := a.cfg.InitAdminPassword
	if password == "" {
		generated, err := security.RandomToken(18)
		if err != nil {
			return err
		}
		password = generated
		log.Printf("首次启动管理员: 用户名=%s 密码=%s", a.cfg.InitAdminUser, password)
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return err
	}
	_, err = a.store.CreateUser(a.cfg.InitAdminUser, "", hash, model.RoleAdmin)
	if err != nil {
		return err
	}
	return a.saveAdminCredential(a.cfg.InitAdminUser, password)
}

// CurrentAdminCredential 返回当前记录的管理员账号和密码；旧库可能没有明文密码记录。
func (a *App) CurrentAdminCredential() (AdminCredential, error) {
	username, err := a.store.GetSetting(adminCredentialUserKey)
	if err != nil {
		return AdminCredential{}, err
	}
	password, err := a.store.GetSetting(adminCredentialPasswordKey)
	if err != nil {
		return AdminCredential{}, err
	}
	if username == "" {
		username = a.cfg.InitAdminUser
	}
	return AdminCredential{Username: username, Password: password, PasswordRecorded: password != ""}, nil
}

// ResetAdminCredential 重置默认管理员账号并返回新的明文密码。
func (a *App) ResetAdminCredential() (AdminCredential, error) {
	username := strings.TrimSpace(a.cfg.InitAdminUser)
	if username == "" {
		username = "admin"
	}
	password, err := security.RandomPassword(10)
	if err != nil {
		return AdminCredential{}, err
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return AdminCredential{}, err
	}
	user, err := a.store.UserByUsername(username)
	if errors.Is(err, sql.ErrNoRows) {
		user, err = a.store.CreateUser(username, "", hash, model.RoleAdmin)
	} else if err == nil {
		user, err = a.store.UpdateUser(user.ID, username, user.Email, model.RoleAdmin, false)
		if err == nil {
			err = a.store.ResetPassword(user.ID, hash)
		}
	}
	if err != nil {
		return AdminCredential{}, err
	}
	_ = a.store.DeleteSessionsForUser(user.ID)
	if err := a.saveAdminCredential(username, password); err != nil {
		return AdminCredential{}, err
	}
	return AdminCredential{Username: username, Password: password, PasswordRecorded: true}, nil
}

// saveAdminCredential 保存托盘菜单可展示的管理员账号和明文密码。
func (a *App) saveAdminCredential(username, password string) error {
	if err := a.store.SetSetting(adminCredentialUserKey, username); err != nil {
		return err
	}
	return a.store.SetSetting(adminCredentialPasswordKey, password)
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
	go func() {
		log.Printf("项目独立端口已启动: project=%d port=%d", project.ID, project.Port)
		if err := server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("项目独立端口异常: project=%d err=%v", project.ID, err)
		}
	}()
	return nil
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
