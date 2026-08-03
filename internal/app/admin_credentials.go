// 文件功能描述：管理初始管理员账号凭据的创建、查询和离线重置。
package app

import (
	"database/sql"
	"errors"
	"log"
	"strings"

	"webshare/internal/config"
	"webshare/internal/model"
	"webshare/internal/security"
	"webshare/internal/store"
)

const (
	adminCredentialUserKey     = "desktop_admin_username"
	adminCredentialPasswordKey = "desktop_admin_password"
)

// AdminCredential 是托盘菜单、离线命令展示管理员账号时返回的明文凭据。
type AdminCredential struct {
	Username         string
	Password         string
	PasswordRecorded bool
}

// ResetStoredAdminCredential 打开数据目录并离线重置默认管理员账号密码。
func ResetStoredAdminCredential(cfg config.Config) (credential AdminCredential, err error) {
	db, err := store.Open(cfg.DataDir)
	if err != nil {
		return AdminCredential{}, err
	}
	defer func() {
		if closeErr := db.Close(); err == nil && closeErr != nil {
			err = closeErr
		}
	}()
	return resetAdminCredential(cfg, db)
}

// ensureInitialAdmin 在空库首次启动时创建管理员；未给密码时生成一次性密码。
func (a *App) ensureInitialAdmin() error {
	count, err := a.store.UserCount()
	if err != nil || count > 0 {
		return err
	}
	password := a.cfg.InitAdminPassword
	if password == "" {
		generated, err := security.RandomToken(18)
		if err != nil {
			return err
		}
		password = generated
		log.Printf("首次启动管理员: 用户名=%s 密码=%s", a.cfg.InitAdminUser, password)
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return err
	}
	_, err = a.store.CreateUser(a.cfg.InitAdminUser, "", hash, model.RoleAdmin)
	if err != nil {
		return err
	}
	return saveAdminCredential(a.store, a.cfg.InitAdminUser, password)
}

// CurrentAdminCredential 返回当前记录的管理员账号和密码；旧库可能没有明文密码记录。
func (a *App) CurrentAdminCredential() (AdminCredential, error) {
	username, err := a.store.GetSetting(adminCredentialUserKey)
	if err != nil {
		return AdminCredential{}, err
	}
	password, err := a.store.GetSetting(adminCredentialPasswordKey)
	if err != nil {
		return AdminCredential{}, err
	}
	if username == "" {
		username = a.cfg.InitAdminUser
	}
	return AdminCredential{Username: username, Password: password, PasswordRecorded: password != ""}, nil
}

// ResetAdminCredential 重置默认管理员账号并返回新的明文密码。
func (a *App) ResetAdminCredential() (AdminCredential, error) {
	return resetAdminCredential(a.cfg, a.store)
}

// resetAdminCredential 重置或创建配置中的管理员用户，并清理旧会话。
func resetAdminCredential(cfg config.Config, db *store.Store) (AdminCredential, error) {
	username := strings.TrimSpace(cfg.InitAdminUser)
	if username == "" {
		username = "admin"
	}
	password, err := security.RandomPassword(10)
	if err != nil {
		return AdminCredential{}, err
	}
	hash, err := security.HashPassword(password)
	if err != nil {
		return AdminCredential{}, err
	}
	user, err := db.UserByUsername(username)
	if errors.Is(err, sql.ErrNoRows) {
		user, err = db.CreateUser(username, "", hash, model.RoleAdmin)
	} else if err == nil {
		user, err = db.UpdateUser(user.ID, username, user.Email, model.RoleAdmin, false)
		if err == nil {
			err = db.ResetPassword(user.ID, hash)
		}
	}
	if err != nil {
		return AdminCredential{}, err
	}
	_ = db.DeleteSessionsForUser(user.ID)
	if err := saveAdminCredential(db, username, password); err != nil {
		return AdminCredential{}, err
	}
	return AdminCredential{Username: username, Password: password, PasswordRecorded: true}, nil
}

// saveAdminCredential 保存可展示的管理员账号和明文密码。
func saveAdminCredential(db *store.Store, username, password string) error {
	if err := db.SetSetting(adminCredentialUserKey, username); err != nil {
		return err
	}
	return db.SetSetting(adminCredentialPasswordKey, password)
}
