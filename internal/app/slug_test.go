// 文件功能描述：验证日期加随机码形式的 slug 自动生成辅助规则。
package app

import (
	"regexp"
	"testing"
)

// TestRandomSlugCode 验证随机码长度和字符范围符合 slug 约束。
func TestRandomSlugCode(t *testing.T) {
	code, err := randomSlugCode(6)
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^[a-z0-9]{6}$`).MatchString(code) {
		t.Fatalf("unexpected code: %q", code)
	}
}
