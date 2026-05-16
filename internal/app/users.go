// 文件功能描述：实现用户管理 API，包括创建用户、禁用用户、修改角色和重置密码。
package app

import (
	"database/sql"
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"webshare/internal/model"
	"webshare/internal/security"
)

// handleUsers 分发用户管理相关接口，所有操作都要求管理员权限。
func (a *App) handleUsers(w http.ResponseWriter, r *http.Request, tail string) {
	if !requireAdmin(w, r) {
		return
	}
	tail = strings.Trim(tail, "/")
	if tail == "" {
		switch r.Method {
		case http.MethodGet:
			users, err := a.store.ListUsers()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "查询用户失败")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"users": users})
		case http.MethodPost:
			a.createUser(w, r)
		default:
			writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		}
		return
	}

	parts := strings.Split(tail, "/")
	id, ok := parseID(parts[0])
	if !ok {
		writeError(w, http.StatusBadRequest, "用户 ID 无效")
		return
	}
	if len(parts) == 1 && r.Method == http.MethodPatch {
		a.updateUser(w, r, id)
		return
	}
	if len(parts) == 2 && parts[1] == "reset-password" && r.Method == http.MethodPost {
		a.resetPassword(w, r, id)
		return
	}
	writeError(w, http.StatusNotFound, "接口不存在")
}

// createUser 创建普通用户或管理员用户。
func (a *App) createUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	username, email, ok := normalizeUserProfile(w, req.Username, req.Email)
	if !ok {
		return
	}
	if req.Role == "" {
		req.Role = model.RoleUser
	}
	if req.Role != model.RoleUser && req.Role != model.RoleAdmin {
		writeError(w, http.StatusBadRequest, "角色必须是 user 或 admin")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "密码至少 8 个字符")
		return
	}
	hash, err := security.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "密码处理失败")
		return
	}
	user, err := a.store.CreateUser(username, email, hash, req.Role)
	if err != nil {
		writeError(w, http.StatusBadRequest, "创建用户失败，用户名或邮箱可能已存在")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": user})
}

// updateUser 更新用户基础资料、角色和禁用状态。
func (a *App) updateUser(w http.ResponseWriter, r *http.Request, id int64) {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Role     string `json:"role"`
		Disabled bool   `json:"disabled"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	username, email, ok := normalizeUserProfile(w, req.Username, req.Email)
	if !ok {
		return
	}
	if req.Role != model.RoleUser && req.Role != model.RoleAdmin {
		writeError(w, http.StatusBadRequest, "角色必须是 user 或 admin")
		return
	}
	if currentUser(r).ID == id && req.Disabled {
		writeError(w, http.StatusBadRequest, "不能禁用当前登录用户")
		return
	}
	user, err := a.store.UpdateUser(id, username, email, req.Role, req.Disabled)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "资源不存在")
			return
		}
		writeError(w, http.StatusBadRequest, "更新用户失败，用户名或邮箱可能已存在")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

// resetPassword 为指定用户重置密码。
func (a *App) resetPassword(w http.ResponseWriter, r *http.Request, id int64) {
	var req struct {
		Password string `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "密码至少 8 个字符")
		return
	}
	hash, err := security.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "密码处理失败")
		return
	}
	if err := a.store.ResetPassword(id, hash); err != nil {
		notFoundOrError(w, err, "重置密码失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// normalizeUserProfile 清理并校验用户基础资料。
func normalizeUserProfile(w http.ResponseWriter, username, email string) (string, string, bool) {
	username = strings.TrimSpace(username)
	email = strings.ToLower(strings.TrimSpace(email))
	if len(username) < 3 {
		writeError(w, http.StatusBadRequest, "用户名至少 3 个字符")
		return "", "", false
	}
	if email == "" {
		return username, "", true
	}
	if _, err := mail.ParseAddress(email); err != nil || strings.Contains(email, " ") {
		writeError(w, http.StatusBadRequest, "邮箱格式不正确")
		return "", "", false
	}
	return username, email, true
}
