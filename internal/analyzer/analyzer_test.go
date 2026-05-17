// 文件功能描述：验证主 base URL 识别、访问模式推荐和“不改写产物”的关键行为。
package analyzer

import (
	"os"
	"path/filepath"
	"testing"

	"webshare/internal/model"
)

// TestAnalyzeRelativeBase 验证相对资源路径推荐标准路径模式。
func TestAnalyzeRelativeBase(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "index.html"), `<script type="module" src="./assets/app.js"></script>`)
	writeFile(t, filepath.Join(root, "assets", "app.js"), `console.log("ok")`)

	result := Analyze(root, "index.html")
	if result.BaseKind != model.BaseRelative || result.RecommendedMode != model.AccessPath {
		t.Fatalf("unexpected result: %+v", result)
	}
}

// TestAnalyzeFixedBase 验证固定前缀推荐自定义挂载路径。
func TestAnalyzeFixedBase(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "index.html"), `<script src="/demo/assets/app.js"></script>`)

	result := Analyze(root, "index.html")
	if result.BaseKind != model.BaseFixed || result.RecommendedMode != model.AccessMount || result.RecommendedMount != "/demo/" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

// TestAnalyzeMultiLevelFixedBase 验证多级固定前缀可以完整识别为挂载路径。
func TestAnalyzeMultiLevelFixedBase(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "index.html"), `<script src="/team/demo/assets/app.js"></script>`)

	result := Analyze(root, "index.html")
	if result.BaseKind != model.BaseFixed || result.RecommendedMode != model.AccessMount || result.RecommendedMount != "/team/demo/" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

// TestAnalyzeMultiLevelRootFileAsset 验证 favicon 等根文件型静态资源也支持多级前缀。
func TestAnalyzeMultiLevelRootFileAsset(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "index.html"), `<link rel="icon" href="/team/demo/favicon.ico">`)

	result := Analyze(root, "index.html")
	if result.BaseKind != model.BaseFixed || result.RecommendedMount != "/team/demo/" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

// TestAnalyzeMultiLevelBaseByFileProbe 验证无静态资源目录时通过文件命中推断最长 base。
func TestAnalyzeMultiLevelBaseByFileProbe(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "index.html"), `<script src="/team/demo/main.js"></script>`)
	writeFile(t, filepath.Join(root, "main.js"), `console.log("ok")`)

	result := Analyze(root, "index.html")
	if result.BaseKind != model.BaseFixed || result.RecommendedMount != "/team/demo/" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

// TestAnalyzeRootBase 验证根路径依赖推荐独立端口。
func TestAnalyzeRootBase(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "index.html"), `<script src="/assets/app.js"></script>`)

	result := Analyze(root, "index.html")
	if result.BaseKind != model.BaseRoot || result.RecommendedMode != model.AccessPort {
		t.Fatalf("unexpected result: %+v", result)
	}
}

// TestAnalyzeDoesNotRewrite 验证分析器不会改写入口 HTML。
func TestAnalyzeDoesNotRewrite(t *testing.T) {
	root := t.TempDir()
	htmlPath := filepath.Join(root, "index.html")
	original := `<base href="/demo/"><script src="/demo/assets/app.js"></script>`
	writeFile(t, htmlPath, original)

	_ = Analyze(root, "index.html")
	after, err := os.ReadFile(htmlPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != original {
		t.Fatalf("analyzer rewrote html: %q", string(after))
	}
}

// writeFile 写入测试文件并自动创建父目录。
func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
