//go:build !windows

// 文件功能描述：应用启动入口，负责加载配置、初始化服务并处理退出信号。
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"static-host/internal/app"
	"static-host/internal/config"
)

// main 负责组装运行环境并启动管理端口、分享端口和项目端口服务。
func main() {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	server, err := app.New(cfg)
	if err != nil {
		log.Fatalf("初始化失败: %v", err)
	}
	if err := server.Start(ctx); err != nil {
		log.Fatalf("服务退出: %v", err)
	}
}
