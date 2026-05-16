// 文件功能描述：管理项目文件目录，提供 ZIP 解压、单 HTML 发布、版本复制和安全路径处理。
package storage

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Manager 封装数据目录下项目版本文件的读写操作。
type Manager struct {
	DataDir string
}

// New 创建文件存储管理器。
func New(dataDir string) Manager {
	return Manager{DataDir: dataDir}
}

// VersionPath 返回指定项目和版本的文件目录。
func (m Manager) VersionPath(projectID, versionID int64) string {
	return filepath.Join(m.DataDir, "projects", fmt.Sprintf("%d", projectID), "versions", fmt.Sprintf("%d", versionID))
}

// PrepareVersionDir 创建干净的版本目录。
func (m Manager) PrepareVersionDir(projectID, versionID int64) (string, error) {
	path := m.VersionPath(projectID, versionID)
	if err := os.RemoveAll(path); err != nil {
		return "", err
	}
	if err := os.MkdirAll(path, 0o755); err != nil {
		return "", err
	}
	return path, nil
}

// DeleteProjectFiles 删除项目所有版本文件。
func (m Manager) DeleteProjectFiles(projectID int64) error {
	return os.RemoveAll(filepath.Join(m.DataDir, "projects", fmt.Sprintf("%d", projectID)))
}

// ExtractZIP 将 ZIP 内容安全解压到目标目录，并在需要时扁平化单层根目录。
func ExtractZIP(src io.ReaderAt, size int64, dest string) error {
	reader, err := zip.NewReader(src, size)
	if err != nil {
		return err
	}
	for _, file := range reader.File {
		if err := extractZipFile(file, dest); err != nil {
			return err
		}
	}
	return normalizeSingleRoot(dest)
}

// WriteHTML 将单 HTML 内容写入目标目录的 index.html。
func WriteHTML(src io.Reader, dest string) error {
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	out, err := os.Create(filepath.Join(dest, "index.html"))
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, src)
	return err
}

// CopyDir 递归复制目录，用于基于当前版本创建新版本。
func CopyDir(src, dest string) error {
	return filepath.WalkDir(src, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dest, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return errors.New("不允许复制符号链接")
		}
		return copyFile(path, target, info.Mode())
	})
}

// WriteFile 在项目版本目录内写入指定路径的文件。
func WriteFile(root, projectPath string, src io.Reader) error {
	target, err := SafeJoin(root, projectPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, src)
	return err
}

// DeletePath 删除项目版本目录内指定文件或目录。
func DeletePath(root, projectPath string) error {
	target, err := SafeJoin(root, projectPath)
	if err != nil {
		return err
	}
	if target == root {
		return errors.New("不能删除版本根目录")
	}
	return os.RemoveAll(target)
}

// ListFiles 列出指定目录下的文件和目录。
func ListFiles(root, projectPath string) ([]FileEntry, error) {
	dir, err := SafeJoin(root, projectPath)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	result := make([]FileEntry, 0)
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		rel := strings.Trim(strings.Trim(projectPath, "/")+"/"+entry.Name(), "/")
		result = append(result, FileEntry{Name: entry.Name(), Path: rel, IsDir: entry.IsDir(), Size: info.Size()})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir
		}
		return result[i].Name < result[j].Name
	})
	return result, nil
}

// DirSize 统计目录总字节数。
func DirSize(root string) (int64, error) {
	var total int64
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		total += info.Size()
		return nil
	})
	return total, err
}

// SafeJoin 将项目相对路径安全拼接到根目录，禁止路径穿越。
func SafeJoin(root, projectPath string) (string, error) {
	cleaned, err := CleanProjectPath(projectPath)
	if err != nil {
		return "", err
	}
	full := filepath.Join(root, filepath.FromSlash(cleaned))
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	fullAbs, err := filepath.Abs(full)
	if err != nil {
		return "", err
	}
	if fullAbs != rootAbs && !strings.HasPrefix(fullAbs, rootAbs+string(os.PathSeparator)) {
		return "", errors.New("路径越界")
	}
	return fullAbs, nil
}

// CleanProjectPath 规范化用户输入的项目内路径。
func CleanProjectPath(projectPath string) (string, error) {
	projectPath = strings.ReplaceAll(projectPath, "\\", "/")
	projectPath = strings.TrimSpace(projectPath)
	projectPath = strings.TrimPrefix(projectPath, "/")
	cleaned := filepath.ToSlash(filepath.Clean(projectPath))
	if cleaned == "." {
		return "", nil
	}
	if strings.HasPrefix(cleaned, "../") || cleaned == ".." || filepath.IsAbs(cleaned) {
		return "", errors.New("非法项目路径")
	}
	return cleaned, nil
}

// FileEntry 是存储层的文件列表项。
type FileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

// extractZipFile 解压单个 ZIP 条目并拒绝不安全路径和符号链接。
func extractZipFile(file *zip.File, dest string) error {
	name := strings.ReplaceAll(file.Name, "\\", "/")
	if strings.HasPrefix(name, "/") || strings.Contains(name, "../") || name == ".." {
		return fmt.Errorf("ZIP 包含非法路径: %s", file.Name)
	}
	info := file.FileInfo()
	if info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("ZIP 包含不允许的符号链接: %s", file.Name)
	}
	target, err := SafeJoin(dest, name)
	if err != nil {
		return err
	}
	if file.FileInfo().IsDir() {
		return os.MkdirAll(target, 0o755)
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode())
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, src)
	return err
}

// normalizeSingleRoot 如果 ZIP 只有单层目录且入口在其中，则把内容移动到版本根目录。
func normalizeSingleRoot(root string) error {
	if _, err := os.Stat(filepath.Join(root, "index.html")); err == nil {
		return nil
	}
	entries, err := os.ReadDir(root)
	if err != nil || len(entries) != 1 || !entries[0].IsDir() {
		return err
	}
	nested := filepath.Join(root, entries[0].Name())
	if _, err := os.Stat(filepath.Join(nested, "index.html")); err != nil {
		return nil
	}
	temp := filepath.Join(root, ".normalize")
	if err := os.Rename(nested, temp); err != nil {
		return err
	}
	children, err := os.ReadDir(temp)
	if err != nil {
		return err
	}
	for _, child := range children {
		if err := os.Rename(filepath.Join(temp, child.Name()), filepath.Join(root, child.Name())); err != nil {
			return err
		}
	}
	return os.RemoveAll(temp)
}

// copyFile 复制单个普通文件。
func copyFile(src, dest string, mode fs.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}
