//go:build windows && !embedrunner

// 文件功能描述：Windows 默认构建使用外部壳程序路径，避免普通测试依赖预生成二进制。
package runnerstub

// WindowsAMD64 默认不内嵌；单 EXE 交付构建使用 embedrunner 标签启用内嵌。
var WindowsAMD64 []byte
