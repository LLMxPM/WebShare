// 文件功能描述：验证 6 位分享密钥接口和分享网关输入页访问流程。
package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"webshare/internal/model"
	"webshare/internal/security"
)

// TestShareKeyAPIReplacesShareToken 验证新分享密钥接口返回短密钥，旧令牌接口不再可用。
func TestShareKeyAPIReplacesShareToken(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()
	project := createActivationTestProject(t, app, "share-key-api")
	cookie := loginAccountTestUser(t, app, "admin", "password-for-test")

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%d/share-key", project.ID), nil)
	request.AddCookie(cookie)
	app.adminHandler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected share-key success, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var resp struct {
		Key      string `json:"key"`
		ShareURL string `json:"shareUrl"`
		Project  struct {
			ShareState string `json:"shareState"`
		} `json:"project"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^[A-Z0-9]{6}$`).MatchString(resp.Key) {
		t.Fatalf("unexpected key: %q", resp.Key)
	}
	if !strings.Contains(resp.ShareURL, "?key="+resp.Key) || strings.Contains(resp.ShareURL, "token=") {
		t.Fatalf("unexpected share url: %q", resp.ShareURL)
	}
	if resp.Project.ShareState != model.ShareToken {
		t.Fatalf("share state = %q, want %q", resp.Project.ShareState, model.ShareToken)
	}

	oldRecorder := httptest.NewRecorder()
	oldRequest := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%d/share-token", project.ID), nil)
	oldRequest.AddCookie(cookie)
	app.adminHandler().ServeHTTP(oldRecorder, oldRequest)
	if oldRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected old share-token route to be 404, got %d", oldRecorder.Code)
	}
}

// TestShareKeyGatewaySlugAccess 验证 /p/{slug}/ 入口支持 key 参数和 Cookie 复用。
func TestShareKeyGatewaySlugAccess(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()
	project := createShareKeyTestProject(t, app, "slug-key", "A2B3C4")

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/p/"+project.Slug+"/?key=a2b3c4", nil)
	request.Header.Set("Accept", "text/html")
	app.shareHandler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), "slug-key access ok") {
		t.Fatalf("expected key access success, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	cookie := findShareCookie(t, recorder, project.ID)
	if cookie.Value != "A2B3C4" {
		t.Fatalf("cookie value = %q, want normalized key", cookie.Value)
	}

	cookieRecorder := httptest.NewRecorder()
	cookieRequest := httptest.NewRequest(http.MethodGet, "/p/"+project.Slug+"/", nil)
	cookieRequest.Header.Set("Accept", "text/html")
	cookieRequest.AddCookie(cookie)
	app.shareHandler().ServeHTTP(cookieRecorder, cookieRequest)
	if cookieRecorder.Code != http.StatusOK || !strings.Contains(cookieRecorder.Body.String(), "slug-key access ok") {
		t.Fatalf("expected cookie access success, got %d body=%s", cookieRecorder.Code, cookieRecorder.Body.String())
	}

	tokenRecorder := httptest.NewRecorder()
	tokenRequest := httptest.NewRequest(http.MethodGet, "/p/"+project.Slug+"/?token=A2B3C4", nil)
	tokenRequest.Header.Set("Accept", "text/html")
	app.shareHandler().ServeHTTP(tokenRecorder, tokenRequest)
	if strings.Contains(tokenRecorder.Body.String(), "slug-key access ok") {
		t.Fatal("expected token query to stop serving project content")
	}
}

// TestShareKeyGatewayFormAndStaticResource 验证无密钥输入页、表单提交和静态资源拒绝策略。
func TestShareKeyGatewayFormAndStaticResource(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()
	project := createShareKeyTestProject(t, app, "form-key", "B3C4D5")

	pageRecorder := httptest.NewRecorder()
	pageRequest := httptest.NewRequest(http.MethodGet, "/p/"+project.Slug+"/", nil)
	pageRequest.Header.Set("Accept", "text/html")
	app.shareHandler().ServeHTTP(pageRecorder, pageRequest)
	if pageRecorder.Code != http.StatusOK || !strings.Contains(pageRecorder.Body.String(), "输入访问密钥") {
		t.Fatalf("expected key page, got %d body=%s", pageRecorder.Code, pageRecorder.Body.String())
	}

	staticRecorder := httptest.NewRecorder()
	staticRequest := httptest.NewRequest(http.MethodGet, "/p/"+project.Slug+"/style.css", nil)
	staticRequest.Header.Set("Accept", "text/css")
	app.shareHandler().ServeHTTP(staticRecorder, staticRequest)
	if staticRecorder.Code != http.StatusForbidden {
		t.Fatalf("expected static asset forbidden, got %d", staticRecorder.Code)
	}

	wrongRecorder := httptest.NewRecorder()
	wrongRequest := shareKeyFormRequest("/p/"+project.Slug+"/", "BAD123", "/p/"+project.Slug+"/")
	app.shareHandler().ServeHTTP(wrongRecorder, wrongRequest)
	if wrongRecorder.Code != http.StatusForbidden || !strings.Contains(wrongRecorder.Body.String(), "密钥无效") {
		t.Fatalf("expected wrong key page, got %d body=%s", wrongRecorder.Code, wrongRecorder.Body.String())
	}

	submitRecorder := httptest.NewRecorder()
	submitRequest := shareKeyFormRequest("/p/"+project.Slug+"/", "b3c4d5", "/p/"+project.Slug+"/")
	app.shareHandler().ServeHTTP(submitRecorder, submitRequest)
	if submitRecorder.Code != http.StatusSeeOther {
		t.Fatalf("expected redirect after key submit, got %d", submitRecorder.Code)
	}
	if location := submitRecorder.Header().Get("Location"); location != "/p/"+project.Slug+"/" {
		t.Fatalf("redirect location = %q", location)
	}
	if cookie := findShareCookie(t, submitRecorder, project.ID); cookie.Value != "B3C4D5" {
		t.Fatalf("cookie value = %q, want normalized key", cookie.Value)
	}
}

// TestShareKeyGatewayMountAndPortAccess 验证密钥网关覆盖挂载路径和独立端口入口。
func TestShareKeyGatewayMountAndPortAccess(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()

	mountProject := createShareKeyTestProject(t, app, "mount-key", "C4D5E6")
	mountProject.MountPath = "/demo/"
	mountProject.AccessMode = model.AccessMount
	if err := app.prepareProjectAccess(&mountProject); err != nil {
		t.Fatal(err)
	}
	mountProject, err := app.store.UpdateProjectSettings(mountProject)
	if err != nil {
		t.Fatal(err)
	}
	mountRecorder := httptest.NewRecorder()
	mountRequest := httptest.NewRequest(http.MethodGet, "/demo/?key=C4D5E6", nil)
	mountRequest.Header.Set("Accept", "text/html")
	app.shareHandler().ServeHTTP(mountRecorder, mountRequest)
	if mountRecorder.Code != http.StatusOK || !strings.Contains(mountRecorder.Body.String(), "mount-key access ok") {
		t.Fatalf("expected mount key access success, got %d body=%s", mountRecorder.Code, mountRecorder.Body.String())
	}

	portProject := createShareKeyTestProject(t, app, "port-key", "D5E6F7")
	portProject.AccessMode = model.AccessPort
	if err := app.prepareProjectAccess(&portProject); err != nil {
		t.Fatal(err)
	}
	portProject, err = app.store.UpdateProjectSettings(portProject)
	if err != nil {
		t.Fatal(err)
	}
	portRecorder := httptest.NewRecorder()
	portRequest := httptest.NewRequest(http.MethodGet, "/?key=D5E6F7", nil)
	portRequest.Header.Set("Accept", "text/html")
	app.serveProjectPort(portProject.ID, portRecorder, portRequest)
	if portRecorder.Code != http.StatusOK || !strings.Contains(portRecorder.Body.String(), "port-key access ok") {
		t.Fatalf("expected port key access success, got %d body=%s", portRecorder.Code, portRecorder.Body.String())
	}
}

// TestShareKeyGatewayRejectsUnsharedAndUnknownPath 验证未分享项目和未知路径不会展示密钥网关。
func TestShareKeyGatewayRejectsUnsharedAndUnknownPath(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()
	project := createShareKeyTestProject(t, app, "unshared-key", "E6F7G8")
	project.ShareState = model.ShareUnshared
	project, err := app.store.UpdateProjectSettings(project)
	if err != nil {
		t.Fatal(err)
	}

	unsharedRecorder := httptest.NewRecorder()
	unsharedRequest := httptest.NewRequest(http.MethodGet, "/p/"+project.Slug+"/?key=E6F7G8", nil)
	unsharedRequest.Header.Set("Accept", "text/html")
	app.shareHandler().ServeHTTP(unsharedRecorder, unsharedRequest)
	if unsharedRecorder.Code != http.StatusForbidden || !strings.Contains(unsharedRecorder.Body.String(), "项目未分享") {
		t.Fatalf("expected unshared project forbidden, got %d body=%s", unsharedRecorder.Code, unsharedRecorder.Body.String())
	}

	missingRecorder := httptest.NewRecorder()
	missingRequest := httptest.NewRequest(http.MethodGet, "/missing/?key=E6F7G8", nil)
	missingRequest.Header.Set("Accept", "text/html")
	app.shareHandler().ServeHTTP(missingRecorder, missingRequest)
	if missingRecorder.Code != http.StatusNotFound {
		t.Fatalf("expected unknown path not found, got %d", missingRecorder.Code)
	}
}

// createShareKeyTestProject 创建带当前版本和固定分享密钥的测试项目。
func createShareKeyTestProject(t *testing.T, app *App, slug, key string) model.Project {
	t.Helper()
	project := createActivationTestProject(t, app, slug)
	version, err := app.store.InsertVersion(project.ID, "html", "", 0, "", nil, 1)
	if err != nil {
		t.Fatal(err)
	}
	versionPath, err := app.files.PrepareVersionDir(project.ID, version.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(versionPath, "index.html"), []byte(slug+" access ok"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(versionPath, "style.css"), []byte("body{color:#17212b}"), 0o644); err != nil {
		t.Fatal(err)
	}
	version, err = app.replaceVersionMetadata(version, versionPath, 1, ".", nil)
	if err != nil {
		t.Fatal(err)
	}
	project.CurrentVersionID = version.ID
	project.ShareState = model.ShareToken
	project.ShareTokenHash = security.TokenHash(normalizeShareKey(key))
	project, err = app.store.UpdateProjectSettings(project)
	if err != nil {
		t.Fatal(err)
	}
	return project
}

// shareKeyFormRequest 创建分享密钥表单提交请求。
func shareKeyFormRequest(pathValue, key, redirect string) *http.Request {
	form := url.Values{}
	form.Set("key", key)
	form.Set("redirect", redirect)
	request := httptest.NewRequest(http.MethodPost, pathValue, strings.NewReader(form.Encode()))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return request
}

// findShareCookie 从响应中查找项目分享 Cookie。
func findShareCookie(t *testing.T, recorder *httptest.ResponseRecorder, projectID int64) *http.Cookie {
	t.Helper()
	name := "share_" + strconvFormat(projectID)
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("response did not set %s cookie", name)
	return nil
}
