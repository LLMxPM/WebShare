//go:build windows

// 文件功能描述：通过 Windows Clipboard API 写入 Unicode 文本，避免依赖外部命令。
package winutil

import (
	"errors"
	"fmt"
	"syscall"
	"time"
	"unsafe"
)

const (
	cfUnicodeText = 13
	gmemMoveable  = 0x0002
)

var (
	user32               = syscall.NewLazyDLL("user32.dll")
	kernel32             = syscall.NewLazyDLL("kernel32.dll")
	procOpenClipboard    = user32.NewProc("OpenClipboard")
	procEmptyClipboard   = user32.NewProc("EmptyClipboard")
	procSetClipboardData = user32.NewProc("SetClipboardData")
	procCloseClipboard   = user32.NewProc("CloseClipboard")
	procGlobalAlloc      = kernel32.NewProc("GlobalAlloc")
	procGlobalLock       = kernel32.NewProc("GlobalLock")
	procGlobalUnlock     = kernel32.NewProc("GlobalUnlock")
	procGlobalFree       = kernel32.NewProc("GlobalFree")
)

// SetClipboardText 将文本写入当前用户会话剪贴板。
func SetClipboardText(text string) error {
	utf16, err := syscall.UTF16FromString(text)
	if err != nil {
		return err
	}
	if err := openClipboardWithRetry(); err != nil {
		return err
	}
	defer procCloseClipboard.Call()

	if ok, _, callErr := procEmptyClipboard.Call(); ok == 0 {
		return fmt.Errorf("清空剪贴板失败: %w", callErr)
	}
	size := uintptr(len(utf16) * 2)
	handle, _, callErr := procGlobalAlloc.Call(gmemMoveable, size)
	if handle == 0 {
		return fmt.Errorf("分配剪贴板内存失败: %w", callErr)
	}
	ownedByClipboard := false
	defer func() {
		if !ownedByClipboard {
			procGlobalFree.Call(handle)
		}
	}()

	ptr, _, callErr := procGlobalLock.Call(handle)
	if ptr == 0 {
		return fmt.Errorf("锁定剪贴板内存失败: %w", callErr)
	}
	copy(unsafe.Slice((*uint16)(unsafe.Pointer(ptr)), len(utf16)), utf16)
	procGlobalUnlock.Call(handle)

	if ok, _, callErr := procSetClipboardData.Call(cfUnicodeText, handle); ok == 0 {
		return fmt.Errorf("写入剪贴板失败: %w", callErr)
	}
	ownedByClipboard = true
	return nil
}

// openClipboardWithRetry 在剪贴板被短暂占用时重试打开。
func openClipboardWithRetry() error {
	var lastErr error
	for i := 0; i < 8; i++ {
		if ok, _, callErr := procOpenClipboard.Call(0); ok != 0 {
			return nil
		} else {
			lastErr = callErr
		}
		time.Sleep(40 * time.Millisecond)
	}
	if lastErr == nil {
		lastErr = errors.New("未知错误")
	}
	return fmt.Errorf("打开剪贴板失败: %w", lastErr)
}
