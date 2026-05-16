// 文件功能描述：验证访问模式、分享状态和保留路径等配置校验规则。
package app

import (
	"testing"

	"webshare/internal/model"
)

// TestNormalizeShareState 验证分享状态只允许规划中的三种取值。
func TestNormalizeShareState(t *testing.T) {
	if got, err := normalizeShareState(""); err != nil || got != model.SharePublic {
		t.Fatalf("unexpected default share state: %s %v", got, err)
	}
	if _, err := normalizeShareState("private"); err == nil {
		t.Fatal("expected private state to be rejected")
	}
}

// TestNormalizeAccessMode 验证访问模式只允许路径、挂载和端口。
func TestNormalizeAccessMode(t *testing.T) {
	for _, mode := range []string{model.AccessPath, model.AccessMount, model.AccessPort} {
		if got, err := normalizeAccessMode(mode); err != nil || got != mode {
			t.Fatalf("unexpected access mode: %s %v", got, err)
		}
	}
	if _, err := normalizeAccessMode("host"); err == nil {
		t.Fatal("expected host mode to be rejected")
	}
}
