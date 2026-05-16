//go:build !windows

// 文件功能描述：为非 Windows 构建提供剪贴板占位实现。
package winutil

import "errors"

// SetClipboardText 在非 Windows 系统不可用。
func SetClipboardText(text string) error {
	return errors.New("剪贴板仅支持 Windows")
}
