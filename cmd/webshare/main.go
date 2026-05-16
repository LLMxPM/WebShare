//go:build !windows

// 文件功能描述：应用启动入口，负责加载配置、初始化服务并处理退出信号。
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"webshare/internal/app"
	"webshare/internal/applog"
	"webshare/internal/config"
)

// main 负责组装运行环境并启动管理端口、分享端口和项目端口服务。
func main() {
	if code := run(); code != 0 {
		os.Exit(code)
	}
}

// run 初始化日志、配置和服务，返回进程退出码。
func run() int {
	cfg := config.Load()
	logger, err := applog.Setup(applog.Config{
		File:       cfg.LogFile,
		Stdout:     cfg.LogStdout,
		MaxSizeMB:  cfg.LogMaxSizeMB,
		MaxBackups: cfg.LogMaxBackups,
		MaxAgeDays: cfg.LogMaxAgeDays,
	})
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "初始化日志失败: %v\n", err)
		return 1
	}
	defer func() {
		if err := logger.Close(); err != nil {
			_, _ = fmt.Fprintf(os.Stderr, "关闭日志失败: %v\n", err)
		}
	}()
	log.Printf("日志已初始化: file=%s stdout=%t", cfg.LogFile, cfg.LogStdout)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	server, err := app.New(cfg)
	if err != nil {
		log.Printf("初始化失败: %v", err)
		return 1
	}
	if err := server.Start(ctx); err != nil {
		log.Printf("服务退出: %v", err)
		return 1
	}
	return 0
}
