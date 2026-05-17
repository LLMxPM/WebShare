// 文件功能描述：提供 HTTP 路由、中间件、JSON 编解码和通用响应工具。
package app

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"webshare/internal/model"
	"webshare/internal/security"
	"webshare/web"
)

type contextKey string

const userContextKey contextKey = "user"

// adminHandler 构建管理端口路由，包括 API 和内嵌前端。
func (a *App) adminHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/login", a.handleLogin)
	mux.HandleFunc("/api/auth/logout", a.handleLogout)
	mux.Handle("/api/", a.authMiddleware(http.HandlerFunc(a.handleAPI)))
	mux.HandleFunc("/", a.serveAdminFrontend)
	return mux
}

// authMiddleware 解析会话 Cookie 并注入当前用户。
func (a *App) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session")
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "请先登录")
			return
		}
		user, err := a.store.UserBySession(security.TokenHash(cookie.Value))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "会话已失效")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userContextKey, user)))
	})
}

// currentUser 从请求上下文读取当前用户。
func currentUser(r *http.Request) model.User {
	user, _ := r.Context().Value(userContextKey).(model.User)
	return user
}

// handleLogin 处理用户名或邮箱密码登录并写入会话 Cookie。
func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	user, err := a.store.UserByLogin(strings.TrimSpace(req.Username))
	if err != nil || user.Disabled || !security.VerifyPassword(req.Password, user.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	token, err := security.RandomToken(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建会话失败")
		return
	}
	expires := time.Now().Add(7 * 24 * time.Hour)
	if err := a.store.CreateSession(user.ID, security.TokenHash(token), expires); err != nil {
		writeError(w, http.StatusInternalServerError, "保存会话失败")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

// handleLogout 删除当前会话 Cookie 和数据库记录。
func (a *App) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}
	if cookie, err := r.Cookie("session"); err == nil {
		_ = a.store.DeleteSession(security.TokenHash(cookie.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: "session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// serveAdminFrontend 提供 /admin 下的前端资源，并把未知路径回退到 index.html。
func (a *App) serveAdminFrontend(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		http.Redirect(w, r, "/admin/", http.StatusFound)
		return
	}
	if !strings.HasPrefix(r.URL.Path, "/admin") {
		http.NotFound(w, r)
		return
	}
	sub, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "管理前端未构建")
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/admin/")
	if path == "" || path == "/admin" {
		path = "index.html"
	}
	if _, err := sub.Open(path); err != nil {
		path = "index.html"
	}
	data, err := fs.ReadFile(sub, path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取管理前端失败")
		return
	}
	if contentType := mime.TypeByExtension(fsExt(path)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	http.ServeContent(w, r, path, time.Time{}, bytes.NewReader(data))
}

// handleAPI 根据路径分发管理 API。
func (a *App) handleAPI(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api")
	switch {
	case path == "/me":
		a.handleMe(w, r)
	case path == "/me/password":
		a.changeOwnPassword(w, r)
	case path == "/users" || strings.HasPrefix(path, "/users/"):
		a.handleUsers(w, r, strings.TrimPrefix(path, "/users"))
	case path == "/system" || strings.HasPrefix(path, "/system/"):
		a.handleSystem(w, r, strings.TrimPrefix(path, "/system"))
	case path == "/projects" || strings.HasPrefix(path, "/projects/"):
		a.handleProjects(w, r, strings.TrimPrefix(path, "/projects"))
	default:
		writeError(w, http.StatusNotFound, "接口不存在")
	}
}

// readJSON 解析 JSON 请求体。
func readJSON(r *http.Request, dest any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dest)
}

// writeJSON 写出 JSON 响应。
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// writeError 写出统一错误响应。
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}

// fsExt 提取静态资源扩展名，用于设置 Content-Type。
func fsExt(path string) string {
	if idx := strings.LastIndex(path, "."); idx >= 0 {
		return path[idx:]
	}
	return ""
}

// parseID 将路径片段解析为 ID。
func parseID(value string) (int64, bool) {
	id, err := strconv.ParseInt(value, 10, 64)
	return id, err == nil && id > 0
}

// requireAdmin 校验当前用户是否为管理员。
func requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	if currentUser(r).Role != model.RoleAdmin {
		writeError(w, http.StatusForbidden, "需要管理员权限")
		return false
	}
	return true
}

// canManageProject 判断用户是否可以管理项目。
func canManageProject(user model.User, project model.Project) bool {
	return user.Role == model.RoleAdmin || project.OwnerID == user.ID
}

// notFoundOrError 将数据库查询错误转换为 HTTP 响应。
func notFoundOrError(w http.ResponseWriter, err error, fallback string) {
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "资源不存在")
		return
	}
	writeError(w, http.StatusInternalServerError, fallback)
}

// publicHostWithPort 生成对外访问使用的 host:port。
func (a *App) publicHostWithPort(port string) string {
	host := a.cfg.PublicHost
	host = a.publicHost()
	if _, _, err := net.SplitHostPort(host); err == nil {
		h, _, _ := net.SplitHostPort(host)
		host = h
	}
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		host = "[" + host + "]"
	}
	return net.JoinHostPort(host, port)
}

// projectDTO 组装项目访问地址和最近版本警告。
func (a *App) projectDTO(project model.Project, r *http.Request) model.ProjectDTO {
	if project.Tags == nil {
		project.Tags = []string{}
	}
	dto := model.ProjectDTO{Project: project, Warnings: []string{}}
	shareHost := a.publicHostWithPort(a.cfg.SharePort())
	dto.AccessURL = fmt.Sprintf("%s://%s/p/%s/", a.cfg.PublicScheme, shareHost, project.Slug)
	if project.AccessMode == model.AccessMount && project.MountPath != "" {
		dto.AccessURL = fmt.Sprintf("%s://%s%s", a.cfg.PublicScheme, shareHost, project.MountPath)
	}
	if project.AccessMode == model.AccessPort && project.Port > 0 {
		dto.AccessURL = fmt.Sprintf("%s://%s/", a.cfg.PublicScheme, a.publicHostWithPort(strconv.Itoa(project.Port)))
	}
	if project.ShareState == model.ShareToken {
		dto.ShareURL = dto.AccessURL + "?key=<重新生成后显示>"
	}
	if version, err := a.store.CurrentVersion(project); err == nil {
		dto.Warnings = version.Warnings
		if dto.Warnings == nil {
			dto.Warnings = []string{}
		}
	}
	dto.Warnings = append(dto.Warnings, a.projectRuntimeWarnings(project.ID)...)
	return dto
}
