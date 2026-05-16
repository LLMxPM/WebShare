//go:build windows

// 文件功能描述：封装 Windows 浏览器打开、剪贴板、托盘图标和错误弹窗工具。
package main

import (
	"encoding/base64"
	"os/exec"
	"syscall"
	"unsafe"

	"static-host/internal/winutil"
)

const trayIconBase64 = "AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAAAAArIRf/KyEX/yshF/8rIRf/KyEX/yshF/8rIRf/KyEX/yshF/8rIRf/KyEX/yshF/8rIRf/KyEX/yshF/8rIRf/KyEX//////9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF///////KyEX/yshF/9jbBf//////2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF///////Y2wX/yshF/8rIRf/Y2wX/2NsF///////Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF///////Y2wX/2NsF/8rIRf/KyEX/2NsF/9jbBf/Y2wX//////9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF///////Y2wX/2NsF/9jbBf/KyEX/yshF/9jbBf/Y2wX/2NsF/9jbBf//////2NsF/9jbBf/Y2wX/2NsF///////Y2wX/2NsF/9jbBf/Y2wX/yshF/8rIRf/Y2wX/2NsF/9jbBf/Y2wX/2NsF///////Y2wX/2NsF///////Y2wX/2NsF/9jbBf/Y2wX/2NsF/8rIRf/KyEX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX////////////Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/KyEX/yshF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF////////////2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/yshF/8rIRf/Y2wX/2NsF/9jbBf/Y2wX/2NsF///////Y2wX/2NsF///////Y2wX/2NsF/9jbBf/Y2wX/2NsF/8rIRf/KyEX/2NsF/9jbBf/Y2wX/2NsF///////Y2wX/2NsF/9jbBf/Y2wX//////9jbBf/Y2wX/2NsF/9jbBf/KyEX/yshF/9jbBf/Y2wX/2NsF///////Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf//////2NsF/9jbBf/Y2wX/yshF/8rIRf/Y2wX/2NsF///////Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF///////Y2wX/2NsF/8rIRf/KyEX/2NsF///////Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX//////9jbBf/KyEX/yshF///////Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf/Y2wX/2NsF/9jbBf//////yshF/8rIRf/KyEX/yshF/8rIRf/KyEX/yshF/8rIRf/KyEX/yshF/8rIRf/KyEX/yshF/8rIRf/KyEX/yshF/8rIRf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="

// openBrowser 通过系统默认浏览器打开本地访问地址。
func openBrowser(target string) error {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Start()
}

// copyText 复制当前访问地址到 Windows 剪贴板。
func copyText(value string) error {
	return winutil.SetClipboardText(value)
}

// trayIcon 返回托盘使用的默认 ICO 图标。
func trayIcon() []byte {
	icon, err := base64.StdEncoding.DecodeString(trayIconBase64)
	if err != nil {
		return nil
	}
	return icon
}

// showError 使用 Windows 消息框展示启动或运行错误。
func showError(title, message string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBox := user32.NewProc("MessageBoxW")
	titlePtr, _ := syscall.UTF16PtrFromString(title)
	messagePtr, _ := syscall.UTF16PtrFromString(message)
	_, _, _ = messageBox.Call(0, uintptr(unsafe.Pointer(messagePtr)), uintptr(unsafe.Pointer(titlePtr)), 0x10)
}
