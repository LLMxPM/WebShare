//go:build windows

// 文件功能描述：提供 EXE 壳程序内的本地静态文件服务和路径映射规则。
package main

import (
	"errors"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"static-host/internal/exebundle"
)

// startServer 监听随机本地端口并启动静态文件服务。
func (a *runnerApp) startServer() error {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	tcpAddr, ok := ln.Addr().(*net.TCPAddr)
	if !ok {
		_ = ln.Close()
		return errors.New("无法识别本地监听端口")
	}
	a.address = net.JoinHostPort("127.0.0.1", strconv.Itoa(tcpAddr.Port))
	a.url = "http://" + a.address + a.manifest.OpenPath
	server := &http.Server{Handler: http.HandlerFunc(a.serveStatic), ReadHeaderTimeout: 10 * time.Second}
	a.server = server
	go func() {
		if err := server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			showError("服务异常", err.Error())
		}
	}()
	return nil
}

// serveStatic 根据 manifest 的 basePath 提供静态文件和 SPA fallback。
func (a *runnerApp) serveStatic(w http.ResponseWriter, r *http.Request) {
	basePath := exebundle.NormalizeBasePath(a.manifest.BasePath)
	if r.URL.Path == strings.TrimSuffix(basePath, "/") {
		http.Redirect(w, r, basePath, http.StatusFound)
		return
	}
	requestPath, ok := routePath(basePath, r.URL.Path)
	if !ok {
		http.NotFound(w, r)
		return
	}
	if requestPath == "" {
		requestPath = entryFileOrDefault(a.manifest.EntryFile)
	}
	target, err := safeJoin(a.tempDir, requestPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if info, err := os.Stat(target); err == nil {
		if info.IsDir() {
			index := filepath.Join(target, "index.html")
			if _, err := os.Stat(index); err == nil {
				http.ServeFile(w, r, index)
				return
			}
		} else {
			http.ServeFile(w, r, target)
			return
		}
	}
	if a.manifest.SPAEnabled && acceptsHTML(r) && !looksStaticAsset(requestPath) {
		entry, err := safeJoin(a.tempDir, entryFileOrDefault(a.manifest.EntryFile))
		if err == nil {
			http.ServeFile(w, r, entry)
			return
		}
	}
	http.NotFound(w, r)
}

// routePath 将 URL 路径转换为项目目录内的相对路径。
func routePath(basePath, requestPath string) (string, bool) {
	if basePath == "/" {
		cleaned := path.Clean("/" + requestPath)
		return strings.TrimPrefix(cleaned, "/"), true
	}
	if requestPath == basePath {
		return "", true
	}
	if !strings.HasPrefix(requestPath, basePath) {
		return "", false
	}
	rel := strings.TrimPrefix(requestPath, basePath)
	rel = strings.TrimPrefix(path.Clean("/"+rel), "/")
	return rel, true
}

// safeJoin 安全拼接静态资源路径，避免路径穿越。
func safeJoin(root, projectPath string) (string, error) {
	projectPath = strings.TrimPrefix(path.Clean("/"+strings.ReplaceAll(projectPath, "\\", "/")), "/")
	target := filepath.Join(root, filepath.FromSlash(projectPath))
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(target)
	if err != nil {
		return "", err
	}
	if targetAbs != rootAbs && !strings.HasPrefix(targetAbs, rootAbs+string(os.PathSeparator)) {
		return "", errors.New("路径越界")
	}
	return targetAbs, nil
}

// entryFileOrDefault 返回入口文件默认值。
func entryFileOrDefault(value string) string {
	value = strings.Trim(strings.ReplaceAll(value, "\\", "/"), "/")
	if value == "" {
		return "index.html"
	}
	return value
}

// acceptsHTML 判断请求是否期望 HTML，用于 SPA fallback。
func acceptsHTML(r *http.Request) bool {
	accept := r.Header.Get("Accept")
	return accept == "" || strings.Contains(accept, "text/html") || strings.Contains(accept, "*/*")
}

// looksStaticAsset 判断路径是否明显是静态资源。
func looksStaticAsset(requestPath string) bool {
	switch strings.ToLower(filepath.Ext(requestPath)) {
	case ".js", ".mjs", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".json", ".webmanifest", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".wasm", ".txt", ".xml":
		return true
	default:
		return false
	}
}
