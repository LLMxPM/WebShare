// 文件功能描述：验证密码哈希和随机令牌摘要的安全基础能力。
package security

import (
	"strings"
	"testing"
)

// TestPasswordHashAndVerify 验证正确密码可通过、错误密码会失败。
func TestPasswordHashAndVerify(t *testing.T) {
	hash, err := HashPassword("secret-password")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword("secret-password", hash) {
		t.Fatal("expected password to verify")
	}
	if VerifyPassword("bad-password", hash) {
		t.Fatal("expected wrong password to fail")
	}
}

// TestRandomDigits 验证随机数字密码长度固定且只包含数字。
func TestRandomDigits(t *testing.T) {
	password, err := RandomDigits(6)
	if err != nil {
		t.Fatal(err)
	}
	if len(password) != 6 {
		t.Fatalf("密码长度 = %d, want 6", len(password))
	}
	for _, char := range password {
		if char < '0' || char > '9' {
			t.Fatalf("密码包含非数字字符: %q", password)
		}
	}
}

// TestRandomPassword 验证复杂随机密码长度固定且覆盖必要字符类型。
func TestRandomPassword(t *testing.T) {
	password, err := RandomPassword(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(password) != 10 {
		t.Fatalf("密码长度 = %d, want 10", len(password))
	}
	var lower, upper, digit, symbol bool
	for _, char := range password {
		switch {
		case strings.ContainsRune(passwordLowercase, char):
			lower = true
		case strings.ContainsRune(passwordUppercase, char):
			upper = true
		case strings.ContainsRune(passwordDigits, char):
			digit = true
		case strings.ContainsRune(passwordSymbols, char):
			symbol = true
		default:
			t.Fatalf("密码包含不在允许字符集内的字符: %q", char)
		}
	}
	if !lower || !upper || !digit || !symbol {
		t.Fatalf("密码未覆盖必要字符类型: %q", password)
	}
}

// TestRandomShareKey 验证分享密钥长度固定且只包含易输入的字母数字。
func TestRandomShareKey(t *testing.T) {
	key, err := RandomShareKey(6)
	if err != nil {
		t.Fatal(err)
	}
	if len(key) != 6 {
		t.Fatalf("密钥长度 = %d, want 6", len(key))
	}
	for _, char := range key {
		if !strings.ContainsRune(shareKeyAlphabet, char) {
			t.Fatalf("密钥包含不在允许字符集内的字符: %q", key)
		}
	}
}

// TestTokenHashStable 验证相同令牌摘要稳定且可常量时间比较。
func TestTokenHashStable(t *testing.T) {
	a := TokenHash("token")
	b := TokenHash("token")
	if a == "" || !ConstantTokenEqual(a, b) {
		t.Fatal("expected token hashes to match")
	}
}
