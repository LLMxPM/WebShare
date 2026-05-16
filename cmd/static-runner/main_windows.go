//go:build windows

// 文件功能描述：Windows 静态页面 EXE 壳程序入口，负责组装资源包、服务和托盘生命周期。
package main

import (
	"context"
	"io"
	"os"
	"time"

	"github.com/getlantern/systray"

	"static-host/internal/exebundle"
)

// runnerApp 保存壳程序运行期间的服务、资源目录和当前访问地址。
type runnerApp struct {
	manifest exebundle.Manifest
	tempDir  string
	server   httpServer
	address  string
	url      string
}

// httpServer 抽象本地服务关闭能力，便于壳程序生命周期管理。
type httpServer interface {
	Shutdown(context.Context) error
}

// main 初始化壳程序，失败时使用 Windows 弹窗提示错误。
func main() {
	app, err := newRunnerApp()
	if err != nil {
		showError("启动失败", err.Error())
		return
	}
	systray.Run(app.onReady, app.onExit)
}

// newRunnerApp 读取资源包、解压静态文件并启动本地 HTTP 服务。
func newRunnerApp() (*runnerApp, error) {
	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}
	file, err := os.Open(exePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	footer, manifest, err := exebundle.ReadMetadata(file)
	if err != nil {
		return nil, err
	}
	zipSection := io.NewSectionReader(file, int64(footer.ZipOffset), int64(footer.ZipSize))
	if err := verifyZipHash(zipSection, footer.ZipSHA256); err != nil {
		return nil, err
	}
	if _, err := zipSection.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	tempDir, err := createTempDir()
	if err != nil {
		return nil, err
	}
	if err := extractZip(zipSection, int64(footer.ZipSize), tempDir); err != nil {
		_ = os.RemoveAll(tempDir)
		return nil, err
	}
	app := &runnerApp{manifest: manifest, tempDir: tempDir}
	if err := app.startServer(); err != nil {
		_ = os.RemoveAll(tempDir)
		return nil, err
	}
	return app, nil
}

// onReady 注册托盘图标、菜单和初次打开浏览器动作。
func (a *runnerApp) onReady() {
	systray.SetIcon(trayIcon())
	systray.SetTitle(a.manifest.Name)
	systray.SetTooltip(a.manifest.Name + " - " + a.url)

	openItem := systray.AddMenuItem("打开页面", "在默认浏览器中打开页面")
	copyItem := systray.AddMenuItem("复制地址", "复制当前本地访问地址")
	systray.AddSeparator()
	quitItem := systray.AddMenuItem("退出", "停止本地服务并退出")

	go func() {
		_ = openBrowser(a.url)
		for {
			select {
			case <-openItem.ClickedCh:
				_ = openBrowser(a.url)
			case <-copyItem.ClickedCh:
				if err := copyText(a.url); err != nil {
					showError("复制失败", err.Error())
				}
			case <-quitItem.ClickedCh:
				systray.Quit()
				return
			}
		}
	}()
}

// onExit 关闭本地服务并清理临时目录。
func (a *runnerApp) onExit() {
	if a.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = a.server.Shutdown(ctx)
	}
	if a.tempDir != "" {
		_ = os.RemoveAll(a.tempDir)
	}
}
