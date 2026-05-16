// 文件功能描述：提供密码哈希、随机令牌、令牌摘要和常量时间校验能力。
package security

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
)

const (
	passwordIterations = 120000
	passwordSaltBytes  = 16
	passwordKeyBytes   = 32
	passwordLowercase  = "abcdefghijkmnopqrstuvwxyz"
	passwordUppercase  = "ABCDEFGHJKLMNPQRSTUVWXYZ"
	passwordDigits     = "23456789"
	passwordSymbols    = "!@#$%&*?"
)

// HashPassword 使用 PBKDF2-HMAC-SHA256 生成可存储的密码摘要。
func HashPassword(password string) (string, error) {
	salt, err := RandomBytes(passwordSaltBytes)
	if err != nil {
		return "", err
	}
	key := pbkdf2SHA256([]byte(password), salt, passwordIterations, passwordKeyBytes)
	return fmt.Sprintf("pbkdf2$%d$%s$%s",
		passwordIterations,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// VerifyPassword 校验明文密码是否匹配存储的 PBKDF2 摘要。
func VerifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2" {
		return false
	}
	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations <= 0 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil || len(expected) == 0 {
		return false
	}
	actual := pbkdf2SHA256([]byte(password), salt, iterations, len(expected))
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

// RandomToken 生成 URL 安全的随机令牌。
func RandomToken(bytesLen int) (string, error) {
	raw, err := RandomBytes(bytesLen)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// RandomDigits 生成指定长度的数字随机密码，允许首位为 0 以保持固定长度。
func RandomDigits(length int) (string, error) {
	if length <= 0 {
		return "", errors.New("随机数字长度必须大于 0")
	}
	var b strings.Builder
	b.Grow(length)
	for i := 0; i < length; i++ {
		value, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		b.WriteByte(byte('0' + value.Int64()))
	}
	return b.String(), nil
}

// RandomPassword 生成复杂随机密码，至少包含大小写字母、数字和符号。
func RandomPassword(length int) (string, error) {
	categories := []string{passwordLowercase, passwordUppercase, passwordDigits, passwordSymbols}
	if length < len(categories) {
		return "", errors.New("复杂密码长度不能小于 4")
	}
	var chars []byte
	for _, category := range categories {
		char, err := randomChar(category)
		if err != nil {
			return "", err
		}
		chars = append(chars, char)
	}
	all := strings.Join(categories, "")
	for len(chars) < length {
		char, err := randomChar(all)
		if err != nil {
			return "", err
		}
		chars = append(chars, char)
	}
	if err := shuffleBytes(chars); err != nil {
		return "", err
	}
	return string(chars), nil
}

// RandomBytes 从系统安全随机源读取指定长度的字节。
func RandomBytes(length int) ([]byte, error) {
	if length <= 0 {
		return nil, errors.New("随机字节长度必须大于 0")
	}
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	return buf, nil
}

// randomChar 从指定字符集中安全随机选择一个字符。
func randomChar(alphabet string) (byte, error) {
	if alphabet == "" {
		return 0, errors.New("随机字符集不能为空")
	}
	index, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
	if err != nil {
		return 0, err
	}
	return alphabet[index.Int64()], nil
}

// shuffleBytes 使用 Fisher-Yates 洗牌打乱密码字符顺序。
func shuffleBytes(items []byte) error {
	for i := len(items) - 1; i > 0; i-- {
		index, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := int(index.Int64())
		items[i], items[j] = items[j], items[i]
	}
	return nil
}

// TokenHash 将令牌转换为固定长度摘要，避免明文存储会话和分享令牌。
func TokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// ConstantTokenEqual 以常量时间比较两个令牌摘要。
func ConstantTokenEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// pbkdf2SHA256 是最小化依赖的 PBKDF2-HMAC-SHA256 实现。
func pbkdf2SHA256(password, salt []byte, iterations, keyLen int) []byte {
	hashLen := sha256.Size
	numBlocks := (keyLen + hashLen - 1) / hashLen
	var derived []byte
	for block := 1; block <= numBlocks; block++ {
		u := pbkdf2F(password, salt, iterations, block)
		derived = append(derived, u...)
	}
	return derived[:keyLen]
}

// pbkdf2F 计算 PBKDF2 的单个块，输入包含密码、盐、迭代次数和块序号。
func pbkdf2F(password, salt []byte, iterations, block int) []byte {
	mac := hmac.New(sha256.New, password)
	mac.Write(salt)
	mac.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
	u := mac.Sum(nil)
	out := append([]byte(nil), u...)
	for i := 1; i < iterations; i++ {
		mac = hmac.New(sha256.New, password)
		mac.Write(u)
		u = mac.Sum(nil)
		for j := range out {
			out[j] ^= u[j]
		}
	}
	return out
}
