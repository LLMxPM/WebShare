// 文件功能描述：实现项目当前版本打包为 Windows EXE 的下载接口和资源包拼接逻辑。
package app

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"static-host/internal/exebundle"
	"static-host/internal/model"
)

// handlePackages 分发项目打包下载相关 API。
func (a *App) handlePackages(w http.ResponseWriter, r *http.Request, project model.Project, parts []string) {
	if len(parts) != 1 || parts[0] != "exe" || r.Method != http.MethodGet {
		writeError(w, http.StatusNotFound, "接口不存在")
		return
	}
	a.downloadProjectEXE(w, r, project)
}

// downloadProjectEXE 将当前项目版本打成单文件 Windows EXE 并返回下载流。
func (a *App) downloadProjectEXE(w http.ResponseWriter, r *http.Request, project model.Project) {
	version, err := a.store.CurrentVersion(project)
	if err != nil {
		notFoundOrError(w, err, "当前项目没有可打包版本")
		return
	}
	exePath, err := a.buildProjectEXE(project, version)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成 EXE 失败: "+err.Error())
		return
	}
	defer os.Remove(exePath)

	file, err := os.Open(exePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取 EXE 失败")
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取 EXE 信息失败")
		return
	}
	w.Header().Set("Content-Type", "application/vnd.microsoft.portable-executable")
	w.Header().Set("Content-Disposition", contentDisposition(project.Name, project.Slug))
	http.ServeContent(w, r, safeDownloadBase(project.Name, project.Slug)+".exe", info.ModTime(), file)
}

// buildProjectEXE 使用预编译壳程序和项目版本目录生成带资源包的 EXE。
func (a *App) buildProjectEXE(project model.Project, version model.ProjectVersion) (string, error) {
	stub, closeStub, err := a.openRunnerStub()
	if err != nil {
		return "", err
	}
	defer closeStub()
	if info, err := os.Stat(version.StoragePath); err != nil || !info.IsDir() {
		if err == nil {
			err = errors.New("版本路径不是目录")
		}
		return "", err
	}

	tmp, err := os.CreateTemp("", "static-host-package-*.exe")
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()
	defer tmp.Close()
	ok := false
	defer func() {
		if !ok {
			_ = os.Remove(tmpPath)
		}
	}()

	stubSize, err := io.Copy(tmp, stub)
	if err != nil {
		return "", err
	}
	zipOffset := uint64(stubSize)
	zipWriter := newHashingCountWriter(tmp)
	if err := writeVersionZip(version.StoragePath, zipWriter); err != nil {
		return "", err
	}
	zipSize := uint64(zipWriter.count)
	basePath := exebundle.NormalizeBasePath(project.DetectedBaseURL)
	manifest := exebundle.Manifest{
		SchemaVersion: exebundle.SchemaVersion,
		Name:          project.Name,
		EntryFile:     entryFileOrDefault(project.EntryFile),
		BasePath:      basePath,
		OpenPath:      basePath,
		SPAEnabled:    project.SPAEnabled,
		CreatedAt:     time.Now().UTC(),
	}
	manifestRaw, err := json.Marshal(manifest)
	if err != nil {
		return "", err
	}
	manifestOffset := zipOffset + zipSize
	if _, err := tmp.Write(manifestRaw); err != nil {
		return "", err
	}
	footer := exebundle.Footer{
		SchemaVersion:  exebundle.SchemaVersion,
		ZipOffset:      zipOffset,
		ZipSize:        zipSize,
		ManifestOffset: manifestOffset,
		ManifestSize:   uint64(len(manifestRaw)),
		ZipSHA256:      zipWriter.sum(),
	}
	if err := exebundle.WriteTrailer(tmp, footer); err != nil {
		return "", err
	}
	ok = true
	return tmpPath, nil
}

// openRunnerStub 优先读取内嵌壳程序；未内嵌时退回到配置路径。
func (a *App) openRunnerStub() (io.Reader, func(), error) {
	if len(a.cfg.RunnerStubBytes) > 0 {
		return bytes.NewReader(a.cfg.RunnerStubBytes), func() {}, nil
	}
	stub, err := os.Open(a.cfg.RunnerStubPath)
	if err != nil {
		return nil, func() {}, fmt.Errorf("读取 Windows 壳程序失败，请先构建 %s: %w", a.cfg.RunnerStubPath, err)
	}
	return stub, func() { _ = stub.Close() }, nil
}

// writeVersionZip 将版本目录压缩到目标 writer，保留相对路径和文件修改时间。
func writeVersionZip(root string, out io.Writer) error {
	archive := zip.NewWriter(out)
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("不支持打包符号链接: %s", path)
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(rel)
		header.Method = zip.Deflate
		writer, err := archive.CreateHeader(header)
		if err != nil {
			return err
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(writer, file)
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
	if closeErr := archive.Close(); err == nil {
		err = closeErr
	}
	return err
}

// hashingCountWriter 同时写出 zip、计算压缩流 SHA256 并统计字节数。
type hashingCountWriter struct {
	out   io.Writer
	hash  hash.Hash
	count int64
}

// newHashingCountWriter 创建 zip 输出统计器。
func newHashingCountWriter(out io.Writer) *hashingCountWriter {
	return &hashingCountWriter{out: out, hash: sha256.New()}
}

// Write 写出数据并同步更新 hash 和字节计数。
func (w *hashingCountWriter) Write(data []byte) (int, error) {
	n, err := w.out.Write(data)
	if n > 0 {
		_, _ = w.hash.Write(data[:n])
		w.count += int64(n)
	}
	return n, err
}

// sum 返回当前 zip 压缩流的 SHA256 十六进制字符串。
func (w *hashingCountWriter) sum() string {
	return hex.EncodeToString(w.hash.Sum(nil))
}

// entryFileOrDefault 返回壳程序使用的入口文件。
func entryFileOrDefault(value string) string {
	value = strings.Trim(strings.ReplaceAll(value, "\\", "/"), "/")
	if value == "" {
		return "index.html"
	}
	return value
}

// contentDisposition 生成兼容中文项目名的下载头。
func contentDisposition(name, fallback string) string {
	display := safeDownloadBase(name, fallback) + ".exe"
	encoded := url.PathEscape(display)
	return fmt.Sprintf(`attachment; filename="%s.exe"; filename*=UTF-8''%s`, safeASCIIFilename(fallback, "project"), encoded)
}

// safeDownloadBase 清理下载文件名中的 Windows 非法字符。
func safeDownloadBase(name, fallback string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		name = fallback
	}
	replacer := strings.NewReplacer("\\", "-", "/", "-", ":", "-", "*", "-", "?", "-", `"`, "-", "<", "-", ">", "-", "|", "-")
	name = strings.TrimSpace(replacer.Replace(name))
	if name == "" {
		return "project"
	}
	return name
}

// safeASCIIFilename 生成 Content-Disposition 的 ASCII fallback 文件名。
func safeASCIIFilename(name, fallback string) string {
	name = safeDownloadBase(name, fallback)
	var b strings.Builder
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-', r == '_', r == '.', r == ' ':
			b.WriteRune(r)
		}
	}
	result := strings.TrimSpace(b.String())
	if result == "" {
		result = "project"
	}
	return result
}
