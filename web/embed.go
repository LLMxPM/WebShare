// 文件功能描述：嵌入管理前端构建产物，为 Go 单体部署提供静态后台资源。
package web

import "embed"

// Dist 包含 pnpm build 生成的管理前端静态资源。
//
//go:embed dist/*
var Dist embed.FS
