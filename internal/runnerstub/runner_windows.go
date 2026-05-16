//go:build windows && embedrunner

// 文件功能描述：按 embedrunner 构建标签内嵌 Windows 静态页面运行壳。
package runnerstub

import _ "embed"

// WindowsAMD64 是预编译的静态页面托盘壳程序。
//
//go:embed static-host-runner-windows-amd64.exe
var WindowsAMD64 []byte
