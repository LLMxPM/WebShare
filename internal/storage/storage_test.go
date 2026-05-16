// 文件功能描述：验证项目文件路径清理和路径穿越防护。
package storage

import "testing"

// TestCleanProjectPath 验证普通路径会被规范为项目内相对路径。
func TestCleanProjectPath(t *testing.T) {
	got, err := CleanProjectPath(`/assets\app.js`)
	if err != nil {
		t.Fatal(err)
	}
	if got != "assets/app.js" {
		t.Fatalf("unexpected path: %s", got)
	}
}

// TestCleanProjectPathRejectTraversal 验证路径穿越会被拒绝。
func TestCleanProjectPathRejectTraversal(t *testing.T) {
	if _, err := CleanProjectPath("../secret.txt"); err == nil {
		t.Fatal("expected traversal path to be rejected")
	}
}
