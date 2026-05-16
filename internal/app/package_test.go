// 文件功能描述：验证项目 EXE 打包器生成的资源包结构和元数据。
package app

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"testing"

	"webshare/internal/config"
	"webshare/internal/exebundle"
	"webshare/internal/model"
)

// TestBuildProjectEXE 验证打包器能把壳文件、静态 zip、manifest 和 footer 拼成可读 EXE。
func TestBuildProjectEXE(t *testing.T) {
	root := t.TempDir()
	stubPath := filepath.Join(root, "runner.exe")
	if err := os.WriteFile(stubPath, []byte("stub-binary"), 0o644); err != nil {
		t.Fatal(err)
	}
	versionPath := filepath.Join(root, "version")
	if err := os.MkdirAll(filepath.Join(versionPath, "js"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(versionPath, "index.html"), []byte(`<script src="/zngz/js/app.js"></script>`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(versionPath, "js", "app.js"), []byte("console.log('ok')"), 0o644); err != nil {
		t.Fatal(err)
	}

	app := &App{cfg: config.Config{RunnerStubPath: stubPath}}
	project := model.Project{Name: "中文项目", EntryFile: "index.html", DetectedBaseURL: "/zngz/", SPAEnabled: true}
	version := model.ProjectVersion{StoragePath: versionPath}
	exePath, err := app.buildProjectEXE(project, version)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(exePath)

	file, err := os.Open(exePath)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	footer, manifest, err := exebundle.ReadMetadata(file)
	if err != nil {
		t.Fatal(err)
	}
	if manifest.BasePath != "/zngz/" || manifest.OpenPath != "/zngz/" || !manifest.SPAEnabled {
		t.Fatalf("manifest 不符合预期: %+v", manifest)
	}
	section := io.NewSectionReader(file, int64(footer.ZipOffset), int64(footer.ZipSize))
	hash := sha256.New()
	if _, err := io.Copy(hash, section); err != nil {
		t.Fatal(err)
	}
	if got := hex.EncodeToString(hash.Sum(nil)); got != footer.ZipSHA256 {
		t.Fatalf("zip sha256 = %s, want %s", got, footer.ZipSHA256)
	}
	if _, err := section.Seek(0, io.SeekStart); err != nil {
		t.Fatal(err)
	}
	archive, err := zip.NewReader(section, int64(footer.ZipSize))
	if err != nil {
		t.Fatal(err)
	}
	if len(archive.File) != 2 {
		t.Fatalf("zip 文件数量 = %d, want 2", len(archive.File))
	}
}
