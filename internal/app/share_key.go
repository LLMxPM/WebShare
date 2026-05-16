// 文件功能描述：提供分享密钥输入页、密钥校验、Cookie 写入和安全重定向辅助逻辑。
package app

import (
	"html/template"
	"net/http"
	"net/url"
	"strings"
	"time"

	"webshare/internal/model"
	"webshare/internal/security"
)

var shareKeyPageTemplate = template.Must(template.New("share-key").Parse(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>输入访问密钥</title>
  <style>
    :root { font-family: "Segoe UI", "Microsoft YaHei", sans-serif; color: #17212b; background: #edf1f4; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; }
    main { width: min(420px, 100%); display: grid; gap: 18px; border: 1px solid #d8dee6; border-radius: 8px; background: #fff; padding: 28px; box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12); }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    p { margin: 0; color: #536170; }
    form { display: grid; gap: 14px; }
    label { display: grid; gap: 6px; color: #536170; font-size: 12px; font-weight: 700; }
    input { width: 100%; min-height: 40px; border: 1px solid #c8d1dc; border-radius: 6px; padding: 8px 10px; font: inherit; letter-spacing: 0; text-transform: uppercase; }
    input:focus { border-color: #24746d; outline: none; box-shadow: 0 0 0 3px rgba(36, 116, 109, 0.14); }
    button { min-height: 40px; border: 1px solid #176c63; border-radius: 6px; background: #176c63; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    .error { border: 1px solid #e1b6b0; border-radius: 8px; background: #fff4f2; color: #a12f2f; padding: 9px 11px; }
  </style>
</head>
<body>
  <main>
    <div>
      <h1>输入访问密钥</h1>
      <p>{{.ProjectName}}</p>
    </div>
    {{if .Error}}<div class="error">{{.Error}}</div>{{end}}
    <form method="post" action="{{.Action}}">
      <input type="hidden" name="redirect" value="{{.Redirect}}">
      <label>访问密钥
        <input name="key" minlength="6" maxlength="6" autocomplete="one-time-code" required autofocus>
      </label>
      <button type="submit">访问项目</button>
    </form>
  </main>
</body>
</html>`))

type shareKeyPageData struct {
	ProjectName string
	Error       string
	Action      string
	Redirect    string
}

// validShareKey 校验输入密钥是否匹配当前项目保存的摘要。
func (a *App) validShareKey(project model.Project, key string) bool {
	key = normalizeShareKey(key)
	return key != "" && project.ShareTokenHash != "" && security.ConstantTokenEqual(security.TokenHash(key), project.ShareTokenHash)
}

// handleShareKeySubmit 处理分享密钥输入页提交，成功后写入 Cookie 并回到原路径。
func (a *App) handleShareKeySubmit(project model.Project, cookieName string, w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "读取密钥失败", http.StatusBadRequest)
		return
	}
	key := normalizeShareKey(r.PostForm.Get("key"))
	if a.validShareKey(project, key) {
		setShareKeyCookie(w, cookieName, key)
		http.Redirect(w, r, cleanShareRedirect(r.PostForm.Get("redirect"), shareRedirectPath(r)), http.StatusSeeOther)
		return
	}
	a.renderShareKeyPage(project, w, r, "密钥无效", http.StatusForbidden)
}

// rejectShareKey 根据请求类型返回输入页或拒绝静态资源访问。
func (a *App) rejectShareKey(project model.Project, requestPath string, w http.ResponseWriter, r *http.Request, message string, status int) {
	if (r.Method == http.MethodGet || r.Method == http.MethodHead) && acceptsHTML(r) && !looksStaticAsset(requestPath) {
		a.renderShareKeyPage(project, w, r, message, status)
		return
	}
	http.Error(w, "分享密钥无效", http.StatusForbidden)
}

// renderShareKeyPage 输出项目分享密钥输入页。
func (a *App) renderShareKeyPage(project model.Project, w http.ResponseWriter, r *http.Request, message string, status int) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_ = shareKeyPageTemplate.Execute(w, shareKeyPageData{
		ProjectName: project.Name,
		Error:       message,
		Action:      r.URL.Path,
		Redirect:    shareRedirectPath(r),
	})
}

// normalizeShareKey 规范化分享密钥输入，降低手动输入大小写错误。
func normalizeShareKey(key string) string {
	return strings.ToUpper(strings.TrimSpace(key))
}

// setShareKeyCookie 写入项目级分享密钥 Cookie，后续访问无需在 URL 中携带密钥。
func setShareKeyCookie(w http.ResponseWriter, cookieName, key string) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    key,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

// shareRedirectPath 返回当前请求去除 key 参数后的本地重定向地址。
func shareRedirectPath(r *http.Request) string {
	target := *r.URL
	query := target.Query()
	query.Del("key")
	target.RawQuery = query.Encode()
	return target.RequestURI()
}

// cleanShareRedirect 防止表单提交把用户重定向到站外地址。
func cleanShareRedirect(value, fallback string) string {
	if value == "" {
		return fallback
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || !strings.HasPrefix(parsed.Path, "/") {
		return fallback
	}
	return parsed.RequestURI()
}
