//go:build !windows

// 文件功能描述：提供 Docker/Linux 环境下的管理员账号离线维护子命令。
package main

import (
	"fmt"
	"os"

	"webshare/internal/app"
	"webshare/internal/config"
)

const adminCommandUsage = `用法:
  webshare admin reset-password [配置参数]

示例:
  webshare admin reset-password -data-dir /data
`

// maybeRunAdminCommand 识别并执行管理员维护子命令，返回是否已经处理和退出码。
func maybeRunAdminCommand(args []string) (bool, int) {
	if len(args) == 0 || args[0] != "admin" {
		return false, 0
	}
	return true, runAdminCommand(args[1:])
}

// runAdminCommand 分发管理员维护命令，目前支持重置默认管理员密码。
func runAdminCommand(args []string) int {
	if len(args) == 0 {
		printAdminCommandUsage()
		return 2
	}
	switch args[0] {
	case "reset-password":
		return runResetAdminPassword(args[1:])
	case "-h", "--help", "help":
		printAdminCommandUsage()
		return 0
	default:
		_, _ = fmt.Fprintf(os.Stderr, "未知管理员命令: %s\n\n", args[0])
		printAdminCommandUsage()
		return 2
	}
}

// runResetAdminPassword 重置数据目录中的默认管理员密码并打印新凭据。
func runResetAdminPassword(args []string) int {
	cfg := config.LoadArgs(args)
	credential, err := app.ResetStoredAdminCredential(cfg)
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "重置管理员密码失败: %v\n", err)
		return 1
	}
	_, _ = fmt.Fprintln(os.Stdout, "管理员账号已重置")
	_, _ = fmt.Fprintf(os.Stdout, "用户名: %s\n", credential.Username)
	_, _ = fmt.Fprintf(os.Stdout, "密码: %s\n", credential.Password)
	return 0
}

// printAdminCommandUsage 输出管理员维护命令帮助信息。
func printAdminCommandUsage() {
	_, _ = fmt.Fprint(os.Stderr, adminCommandUsage)
}
