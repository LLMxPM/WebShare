//go:build windows

// 文件功能描述：处理 EXE 壳程序中的资源包校验、解压和临时目录创建。
package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// verifyZipHash 校验 EXE 中资源包 zip 的 SHA256。
func verifyZipHash(section *io.SectionReader, want string) error {
	hash := sha256.New()
	if _, err := io.Copy(hash, section); err != nil {
		return err
	}
	got := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(got, want) {
		return fmt.Errorf("资源包校验失败: %s", got)
	}
	return nil
}

// extractZip 将资源包解压到临时目录，并拒绝不安全路径和符号链接。
func extractZip(reader io.ReaderAt, size int64, dest string) error {
	archive, err := zip.NewReader(reader, size)
	if err != nil {
		return err
	}
	for _, file := range archive.File {
		name := strings.ReplaceAll(file.Name, "\\", "/")
		if name == "" || strings.HasPrefix(name, "/") || strings.Contains(name, "../") || name == ".." {
			return fmt.Errorf("资源包包含非法路径: %s", file.Name)
		}
		info := file.FileInfo()
		if info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("资源包包含不支持的符号链接: %s", file.Name)
		}
		target, err := safeJoin(dest, name)
		if err != nil {
			return err
		}
		if info.IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		if err := extractZipFile(file, target, info.Mode()); err != nil {
			return err
		}
	}
	return nil
}

// extractZipFile 解压单个普通文件并保留权限。
func extractZipFile(file *zip.File, target string, mode os.FileMode) error {
	in, err := file.Open()
	if err != nil {
		return err
	}
	out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		_ = in.Close()
		return err
	}
	_, copyErr := io.Copy(out, in)
	closeInErr := in.Close()
	closeOutErr := out.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeInErr != nil {
		return closeInErr
	}
	return closeOutErr
}

// createTempDir 创建壳程序解压静态资源使用的临时目录。
func createTempDir() (string, error) {
	base := filepath.Join(os.TempDir(), "webshare-runner")
	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", err
	}
	return os.MkdirTemp(base, "run-*")
}
