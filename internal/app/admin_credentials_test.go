// 文件功能描述：验证管理员凭据初始化、保存和离线重置能力。
package app

import (
	"testing"

	"webshare/internal/config"
	"webshare/internal/model"
	"webshare/internal/security"
	"webshare/internal/store"
)

// TestResetStoredAdminCredentialCreatesAndUpdatesAdmin 验证离线命令会创建或更新管理员密码。
func TestResetStoredAdminCredentialCreatesAndUpdatesAdmin(t *testing.T) {
	cfg := config.Config{DataDir: t.TempDir(), InitAdminUser: "admin"}
	first, err := ResetStoredAdminCredential(cfg)
	if err != nil {
		t.Fatalf("首次重置管理员密码失败: %v", err)
	}
	if !first.PasswordRecorded || first.Username != "admin" || first.Password == "" {
		t.Fatalf("管理员凭据不完整: %+v", first)
	}
	assertStoredAdminCredential(t, cfg.DataDir, first, "")

	second, err := ResetStoredAdminCredential(cfg)
	if err != nil {
		t.Fatalf("再次重置管理员密码失败: %v", err)
	}
	if second.Password == "" || second.Password == first.Password {
		t.Fatalf("expected new password, got first=%q second=%q", first.Password, second.Password)
	}
	assertStoredAdminCredential(t, cfg.DataDir, second, first.Password)
}

// assertStoredAdminCredential 校验数据库中的管理员账号、明文记录和密码哈希一致。
func assertStoredAdminCredential(t *testing.T, dataDir string, credential AdminCredential, oldPassword string) {
	t.Helper()
	db, err := store.Open(dataDir)
	if err != nil {
		t.Fatalf("打开数据库失败: %v", err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			t.Fatalf("关闭数据库失败: %v", err)
		}
	}()
	user, err := db.UserByUsername(credential.Username)
	if err != nil {
		t.Fatalf("查询管理员失败: %v", err)
	}
	if user.Role != model.RoleAdmin || user.Disabled {
		t.Fatalf("管理员状态不正确: role=%s disabled=%t", user.Role, user.Disabled)
	}
	if !security.VerifyPassword(credential.Password, user.PasswordHash) {
		t.Fatal("新密码不能通过哈希校验")
	}
	if oldPassword != "" && security.VerifyPassword(oldPassword, user.PasswordHash) {
		t.Fatal("旧密码仍然可以通过哈希校验")
	}
	username, err := db.GetSetting(adminCredentialUserKey)
	if err != nil {
		t.Fatalf("查询管理员用户名记录失败: %v", err)
	}
	password, err := db.GetSetting(adminCredentialPasswordKey)
	if err != nil {
		t.Fatalf("查询管理员密码记录失败: %v", err)
	}
	if username != credential.Username || password != credential.Password {
		t.Fatalf("明文凭据记录不一致: username=%q password=%q", username, password)
	}
}
