//go:build windows

// 文件功能描述：Windows 单 EXE 托盘入口，负责启动服务、打开后台和管理管理员凭据。
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/getlantern/systray"

	"webshare/internal/app"
	"webshare/internal/applog"
	"webshare/internal/config"
	"webshare/internal/runnerstub"
)

// desktopApp 保存主程序托盘运行状态。
type desktopApp struct {
	app      *app.App
	cancel   context.CancelFunc
	done     chan error
	adminURL string
}

// main 启动 Windows 托盘版静态托管服务。
func main() {
	_ = useExecutableDir()
	cfg := config.Load()
	cfg.RunnerStubBytes = runnerstub.WindowsAMD64
	logger, err := applog.Setup(applog.Config{
		File:       cfg.LogFile,
		Stdout:     cfg.LogStdout,
		MaxSizeMB:  cfg.LogMaxSizeMB,
		MaxBackups: cfg.LogMaxBackups,
		MaxAgeDays: cfg.LogMaxAgeDays,
	})
	if err != nil {
		showError("日志初始化失败", err.Error())
		return
	}
	defer func() {
		if err := logger.Close(); err != nil {
			showError("日志关闭失败", err.Error())
		}
	}()
	log.Printf("日志已初始化: file=%s stdout=%t", cfg.LogFile, cfg.LogStdout)

	server, err := app.New(cfg)
	if err != nil {
		log.Printf("启动失败: %v", err)
		showError("启动失败", err.Error())
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	desktop := &desktopApp{
		app:      server,
		cancel:   cancel,
		done:     make(chan error, 1),
		adminURL: adminURL(cfg.AdminAddr),
	}
	go func() {
		desktop.done <- server.Start(ctx)
	}()
	systray.Run(desktop.onReady, desktop.onExit)
}

// onReady 注册主程序托盘菜单并自动打开管理后台。
func (d *desktopApp) onReady() {
	systray.SetIcon(trayIcon())
	systray.SetTitle("WebShare")
	systray.SetTooltip("WebShare - " + d.adminURL)

	openItem := systray.AddMenuItem("打开管理页面", "在默认浏览器中打开管理后台")
	copyItem := systray.AddMenuItem("复制管理地址", "复制管理后台访问地址")
	showAdminItem := systray.AddMenuItem("显示管理员账户和密码", "查看当前记录的管理员登录凭据")
	copyAdminItem := systray.AddMenuItem("复制管理员账户和密码", "复制当前记录的管理员登录凭据")
	resetAdminItem := systray.AddMenuItem("重置管理员账户", "重置默认管理员密码并显示新密码")
	systray.AddSeparator()
	quitItem := systray.AddMenuItem("退出", "停止服务并退出程序")

	go func() {
		time.Sleep(500 * time.Millisecond)
		_ = openBrowser(d.adminURL)
		for {
			select {
			case <-openItem.ClickedCh:
				_ = openBrowser(d.adminURL)
			case <-copyItem.ClickedCh:
				if err := copyText(d.adminURL); err != nil {
					showError("复制失败", err.Error())
				}
			case <-showAdminItem.ClickedCh:
				d.showAdminCredential()
			case <-copyAdminItem.ClickedCh:
				d.copyAdminCredential()
			case <-resetAdminItem.ClickedCh:
				d.resetAdminCredential()
			case <-quitItem.ClickedCh:
				systray.Quit()
				return
			case err := <-d.done:
				if err != nil && !strings.Contains(err.Error(), "context canceled") {
					log.Printf("服务退出: %v", err)
					showError("服务退出", err.Error())
				}
				systray.Quit()
				return
			}
		}
	}()
}

// onExit 停止 HTTP 服务并等待资源释放。
func (d *desktopApp) onExit() {
	log.Print("正在退出托盘程序")
	if d.cancel != nil {
		d.cancel()
	}
	select {
	case <-d.done:
	case <-time.After(9 * time.Second):
		log.Print("等待服务停止超时")
	}
	log.Print("托盘程序已退出")
}

// showAdminCredential 显示当前记录的管理员账号和密码。
func (d *desktopApp) showAdminCredential() {
	credential, err := d.app.CurrentAdminCredential()
	if err != nil {
		showError("读取失败", err.Error())
		return
	}
	if !credential.PasswordRecorded {
		showInfo("管理员账户", fmt.Sprintf("用户名：%s\n密码：未记录\n\n旧数据无法反查明文密码，请使用“重置管理员账户”生成新密码。", credential.Username))
		return
	}
	showInfo("管理员账户", credentialText(credential))
}

// copyAdminCredential 将当前记录的管理员账号密码复制到剪贴板。
func (d *desktopApp) copyAdminCredential() {
	credential, err := d.app.CurrentAdminCredential()
	if err != nil {
		showError("读取失败", err.Error())
		return
	}
	if !credential.PasswordRecorded {
		showInfo("管理员账户", "当前没有记录明文密码，请使用“重置管理员账户”生成新密码。")
		return
	}
	if err := copyText(credentialText(credential)); err != nil {
		showError("复制失败", err.Error())
		return
	}
	showInfo("复制成功", "管理员账户和密码已复制到剪贴板。")
}

// resetAdminCredential 重置管理员账号并把新凭据展示给用户。
func (d *desktopApp) resetAdminCredential() {
	credential, err := d.app.ResetAdminCredential()
	if err != nil {
		showError("重置失败", err.Error())
		return
	}
	text := credentialText(credential)
	copyMessage := "\n\n新凭据已复制到剪贴板。"
	if err := copyText(text); err != nil {
		copyMessage = "\n\n复制到剪贴板失败：" + err.Error()
	}
	showInfo("管理员账户已重置", text+copyMessage)
}

// credentialText 格式化管理员凭据。
func credentialText(credential app.AdminCredential) string {
	return fmt.Sprintf("用户名：%s\n密码：%s", credential.Username, credential.Password)
}

// adminURL 根据监听地址生成本机管理后台地址。
func adminURL(addr string) string {
	port := "8080"
	if _, parsedPort, err := net.SplitHostPort(addr); err == nil && parsedPort != "" {
		port = parsedPort
	} else if idx := strings.LastIndex(addr, ":"); idx >= 0 && idx < len(addr)-1 {
		port = addr[idx+1:]
	}
	return "http://127.0.0.1:" + port + "/admin/"
}

// useExecutableDir 将 Windows 双击启动时的数据目录固定到 exe 所在目录下。
func useExecutableDir() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	return os.Chdir(filepath.Dir(exe))
}
