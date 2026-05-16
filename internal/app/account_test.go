// 文件功能描述：验证当前登录用户自助修改邮箱和密码的账号接口。
package app

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"webshare/internal/config"
	"webshare/internal/security"
)

// TestUpdateOwnEmail 验证用户可以修改自己的邮箱且响应会返回最新用户资料。
func TestUpdateOwnEmail(t *testing.T) {
	app := newAccountTestApp(t)
	defer app.store.Close()
	cookie := loginAccountTestUser(t, app, "admin", "password-for-test")

	recorder := httptest.NewRecorder()
	request := accountJSONRequest(t, http.MethodPatch, "/api/me", map[string]string{"email": "Owner@Example.com"})
	request.AddCookie(cookie)
	app.adminHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected email update success, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var resp struct {
		User struct {
			Email string `json:"email"`
		} `json:"user"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp.User.Email != "owner@example.com" {
		t.Fatalf("unexpected email: %q", resp.User.Email)
	}
}

// TestChangeOwnPassword 验证修改密码需要当前密码，成功后旧密码不可再登录。
func TestChangeOwnPassword(t *testing.T) {
	app := newAccountTestApp(t)
	defer app.store.Close()
	cookie := loginAccountTestUser(t, app, "admin", "password-for-test")

	wrong := httptest.NewRecorder()
	wrongReq := accountJSONRequest(t, http.MethodPost, "/api/me/password", map[string]string{
		"currentPassword": "bad-password",
		"newPassword":     "new-password-123",
	})
	wrongReq.AddCookie(cookie)
	app.adminHandler().ServeHTTP(wrong, wrongReq)
	if wrong.Code != http.StatusBadRequest {
		t.Fatalf("expected wrong current password to be rejected, got %d", wrong.Code)
	}

	recorder := httptest.NewRecorder()
	request := accountJSONRequest(t, http.MethodPost, "/api/me/password", map[string]string{
		"currentPassword": "password-for-test",
		"newPassword":     "new-password-123",
	})
	request.AddCookie(cookie)
	app.adminHandler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected password update success, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	user, err := app.store.UserByUsername("admin")
	if err != nil {
		t.Fatal(err)
	}
	if security.VerifyPassword("password-for-test", user.PasswordHash) {
		t.Fatal("expected old password to be invalid")
	}
	if !security.VerifyPassword("new-password-123", user.PasswordHash) {
		t.Fatal("expected new password to be valid")
	}

	stillLoggedIn := httptest.NewRecorder()
	meReq := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	meReq.AddCookie(cookie)
	app.adminHandler().ServeHTTP(stillLoggedIn, meReq)
	if stillLoggedIn.Code != http.StatusOK {
		t.Fatalf("expected current session to remain valid, got %d", stillLoggedIn.Code)
	}
}

// newAccountTestApp 创建带固定管理员密码的账号接口测试应用。
func newAccountTestApp(t *testing.T) *App {
	t.Helper()
	app, err := New(config.Config{
		DataDir:           t.TempDir(),
		PublicHost:        "localhost",
		PublicScheme:      "http",
		InitAdminUser:     "admin",
		InitAdminPassword: "password-for-test",
	})
	if err != nil {
		t.Fatal(err)
	}
	return app
}

// loginAccountTestUser 登录测试用户并返回会话 Cookie。
func loginAccountTestUser(t *testing.T, app *App, username, password string) *http.Cookie {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := accountJSONRequest(t, http.MethodPost, "/api/auth/login", map[string]string{
		"username": username,
		"password": password,
	})
	app.adminHandler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("login failed: %d body=%s", recorder.Code, recorder.Body.String())
	}
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == "session" {
			return cookie
		}
	}
	t.Fatal("login did not set session cookie")
	return nil
}

// accountJSONRequest 创建带 JSON 请求体和请求头的测试请求。
func accountJSONRequest(t *testing.T, method, path string, payload any) *http.Request {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	return request
}
