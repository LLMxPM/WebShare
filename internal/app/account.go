// 文件功能描述：实现当前登录用户查看资料、修改邮箱和修改密码的账号接口。
package app

import (
	"database/sql"
	"errors"
	"net/http"

	"webshare/internal/security"
)

// handleMe 返回或更新当前登录用户的基础资料。
func (a *App) handleMe(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"user": currentUser(r)})
	case http.MethodPatch:
		a.updateOwnProfile(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "方法不允许")
	}
}

// updateOwnProfile 允许当前用户修改自己的邮箱，不开放角色、禁用状态等权限字段。
func (a *App) updateOwnProfile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	current := currentUser(r)
	_, email, ok := normalizeUserProfile(w, current.Username, req.Email)
	if !ok {
		return
	}
	user, err := a.store.UpdateUser(current.ID, current.Username, email, current.Role, current.Disabled)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "资源不存在")
			return
		}
		writeError(w, http.StatusBadRequest, "更新邮箱失败，邮箱可能已存在")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

// changeOwnPassword 校验当前密码后更新当前用户密码，并保留当前会话。
func (a *App) changeOwnPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}
	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	current := currentUser(r)
	if !security.VerifyPassword(req.CurrentPassword, current.PasswordHash) {
		writeError(w, http.StatusBadRequest, "当前密码不正确")
		return
	}
	if len(req.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "新密码至少 8 个字符")
		return
	}
	hash, err := security.HashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "密码处理失败")
		return
	}
	if err := a.store.ResetPassword(current.ID, hash); err != nil {
		notFoundOrError(w, err, "修改密码失败")
		return
	}
	if cookie, err := r.Cookie("session"); err == nil {
		_ = a.store.DeleteOtherSessionsForUser(current.ID, security.TokenHash(cookie.Value))
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
