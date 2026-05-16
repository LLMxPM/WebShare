//go:build !windows

// 文件功能描述：为非 Windows 构建提供空的壳程序占位，保持主程序可跨平台编译。
package runnerstub

// WindowsAMD64 在非 Windows 构建中不内嵌，由 RUNNER_STUB_PATH 指向外部壳文件。
var WindowsAMD64 []byte
