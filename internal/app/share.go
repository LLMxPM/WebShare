// 文件功能描述：实现分享网关和项目独立端口下的静态文件访问、分享密钥校验和 SPA fallback。
package app

import (
	"database/sql"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"webshare/internal/model"
	"webshare/internal/storage"
)

// shareHandler 构建分享网关路由，支持 /p/{slug}/ 和自定义挂载路径。
func (a *App) shareHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" || r.URL.Path == "/healthz/" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}
		if strings.HasPrefix(r.URL.Path, "/p/") {
			a.serveSlugPath(w, r)
			return
		}
		a.serveMountPath(w, r)
	})
}

// serveSlugPath 处理 /p/{slug}/ 形式的访问。
func (a *App) serveSlugPath(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/p/")
	parts := strings.SplitN(rest, "/", 2)
	if parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	project, err := a.store.ProjectBySlug(parts[0])
	if err != nil {
		http.NotFound(w, r)
		return
	}
	filePath := ""
	if len(parts) == 2 {
		filePath = parts[1]
	}
	a.serveProject(project, filePath, w, r)
}

// serveMountPath 处理自定义挂载路径访问。
func (a *App) serveMountPath(w http.ResponseWriter, r *http.Request) {
	projects, err := a.store.ListAllProjects()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询项目失败")
		return
	}
	for _, project := range projects {
		if !project.Active || project.AccessMode != model.AccessMount || project.MountPath == "" {
			continue
		}
		if r.URL.Path == strings.TrimSuffix(project.MountPath, "/") {
			http.Redirect(w, r, project.MountPath, http.StatusFound)
			return
		}
		if strings.HasPrefix(r.URL.Path, project.MountPath) {
			filePath := strings.TrimPrefix(r.URL.Path, project.MountPath)
			a.serveProject(project, filePath, w, r)
			return
		}
	}
	http.NotFound(w, r)
}

// serveProjectPort 处理项目独立端口访问。
func (a *App) serveProjectPort(projectID int64, w http.ResponseWriter, r *http.Request) {
	project, err := a.store.ProjectByID(projectID)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	filePath := strings.TrimPrefix(r.URL.Path, "/")
	if project.MountPath != "" && strings.HasPrefix(r.URL.Path, project.MountPath) {
		filePath = strings.TrimPrefix(r.URL.Path, project.MountPath)
	}
	a.serveProject(project, filePath, w, r)
}

// serveProject 校验分享权限后，从项目当前版本目录提供静态文件。
func (a *App) serveProject(project model.Project, requestPath string, w http.ResponseWriter, r *http.Request) {
	if !project.Active {
		http.Error(w, "项目已停用", http.StatusForbidden)
		return
	}
	if !a.allowSharedAccess(project, requestPath, w, r) {
		return
	}
	version, err := a.store.CurrentVersion(project)
	if err != nil {
		if err == sql.ErrNoRows {
			http.NotFound(w, r)
			return
		}
		writeError(w, http.StatusInternalServerError, "读取项目版本失败")
		return
	}
	requestPath = strings.TrimPrefix(path.Clean("/"+requestPath), "/")
	if requestPath == "." || requestPath == "" {
		requestPath = project.EntryFile
	}
	target, err := storage.SafeJoin(version.StoragePath, requestPath)
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
	if project.SPAEnabled && acceptsHTML(r) && !looksStaticAsset(requestPath) {
		entry, err := storage.SafeJoin(version.StoragePath, project.EntryFile)
		if err == nil {
			http.ServeFile(w, r, entry)
			return
		}
	}
	http.NotFound(w, r)
}

// allowSharedAccess 根据 public、share、unshared 状态判断外部访问权限。
func (a *App) allowSharedAccess(project model.Project, requestPath string, w http.ResponseWriter, r *http.Request) bool {
	switch project.ShareState {
	case model.SharePublic:
		return true
	case model.ShareUnshared:
		http.Error(w, "项目未分享", http.StatusForbidden)
		return false
	case model.ShareToken:
		cookieName := "share_" + strconvFormat(project.ID)
		if key := normalizeShareKey(r.URL.Query().Get("key")); key != "" {
			if a.validShareKey(project, key) {
				setShareKeyCookie(w, cookieName, key)
				return true
			}
			a.rejectShareKey(project, requestPath, w, r, "密钥无效", http.StatusForbidden)
			return false
		}
		if cookie, err := r.Cookie(cookieName); err == nil && a.validShareKey(project, cookie.Value) {
			setShareKeyCookie(w, cookieName, cookie.Value)
			return true
		}
		if r.Method == http.MethodPost {
			a.handleShareKeySubmit(project, cookieName, w, r)
			return false
		}
		a.rejectShareKey(project, requestPath, w, r, "", http.StatusOK)
		return false
	default:
		http.Error(w, "分享状态无效", http.StatusForbidden)
		return false
	}
}

// acceptsHTML 判断请求是否期望 HTML，用于 SPA history fallback。
func acceptsHTML(r *http.Request) bool {
	accept := r.Header.Get("Accept")
	return accept == "" || strings.Contains(accept, "text/html") || strings.Contains(accept, "*/*")
}

// looksStaticAsset 判断路径是否明显是静态资源，避免把 HTML 返回给 JS/CSS/图片请求。
func looksStaticAsset(requestPath string) bool {
	ext := strings.ToLower(filepath.Ext(requestPath))
	switch ext {
	case ".js", ".mjs", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".json", ".webmanifest", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".wasm", ".txt", ".xml":
		return true
	default:
		return false
	}
}

// strconvFormat 将整数 ID 转为字符串，避免在访问热路径引入重复格式代码。
func strconvFormat(id int64) string {
	return strconv.FormatInt(id, 10)
}
