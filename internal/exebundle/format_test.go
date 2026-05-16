// 文件功能描述：验证静态页面 EXE 资源包尾部格式的读写和路径规范化。
package exebundle

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

// TestReadMetadata 验证 footer 和 manifest 能从文件尾部反向定位。
func TestReadMetadata(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "bundle-*.exe")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	if _, err := file.Write([]byte("stub")); err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write([]byte("zip")); err != nil {
		t.Fatal(err)
	}
	manifest := Manifest{
		SchemaVersion: SchemaVersion,
		Name:          "demo",
		EntryFile:     "index.html",
		BasePath:      "/zngz/",
		OpenPath:      "/zngz/",
		SPAEnabled:    true,
		CreatedAt:     time.Now().UTC(),
	}
	rawManifest, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(rawManifest); err != nil {
		t.Fatal(err)
	}
	footer := Footer{
		SchemaVersion:  SchemaVersion,
		ZipOffset:      4,
		ZipSize:        3,
		ManifestOffset: 7,
		ManifestSize:   uint64(len(rawManifest)),
		ZipSHA256:      "abc",
	}
	if err := WriteTrailer(file, footer); err != nil {
		t.Fatal(err)
	}

	gotFooter, gotManifest, err := ReadMetadata(file)
	if err != nil {
		t.Fatal(err)
	}
	if gotFooter.ZipOffset != footer.ZipOffset || gotManifest.BasePath != manifest.BasePath {
		t.Fatalf("读取结果不匹配: footer=%+v manifest=%+v", gotFooter, gotManifest)
	}
}

// TestNormalizeBasePath 验证 base URL 到壳挂载路径的转换规则。
func TestNormalizeBasePath(t *testing.T) {
	cases := map[string]string{
		"":             "/",
		".":            "/",
		"./":           "/",
		"/":            "/",
		"/zngz":        "/zngz/",
		"/zngz/":       "/zngz/",
		"https://host": "/",
	}
	for input, want := range cases {
		if got := NormalizeBasePath(input); got != want {
			t.Fatalf("NormalizeBasePath(%q) = %q, want %q", input, got, want)
		}
	}
}
