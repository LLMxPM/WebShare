// 文件功能描述：实现 ZIP、文件夹、单 HTML 发布和文件管理版本化写入。
package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"webshare/internal/analyzer"
	"webshare/internal/model"
	"webshare/internal/storage"
)

// handlePublish 处理 ZIP、文件夹和单 HTML 发布入口。
func (a *App) handlePublish(w http.ResponseWriter, r *http.Request, project model.Project, parts []string) {
	if r.Method != http.MethodPost || len(parts) != 1 {
		writeError(w, http.StatusNotFound, "接口不存在")
		return
	}
	switch parts[0] {
	case "zip":
		a.publishZIP(w, r, project)
	case "html":
		a.publishHTML(w, r, project)
	case "folder":
		a.publishFolder(w, r, project)
	default:
		writeError(w, http.StatusNotFound, "接口不存在")
	}
}

// publishZIP 上传 ZIP 构建产物并创建新版本。
func (a *App) publishZIP(w http.ResponseWriter, r *http.Request, project model.Project) {
	file, header, err := readUploadFile(r, a.cfg.MaxUploadBytes)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	defer file.Close()
	raw, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, "读取上传文件失败")
		return
	}
	project, version, err := a.createPublishedVersion(project, currentUser(r).ID, "zip", func(dest string) error {
		return storage.ExtractZIP(bytes.NewReader(raw), int64(len(raw)), dest)
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = header
	writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(project, r), "version": version})
}

// publishHTML 上传单个 HTML 文件并作为 index.html 发布。
func (a *App) publishHTML(w http.ResponseWriter, r *http.Request, project model.Project) {
	file, _, err := readUploadFile(r, a.cfg.MaxUploadBytes)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	defer file.Close()
	project.EntryFile = "index.html"
	project, version, err := a.createPublishedVersion(project, currentUser(r).ID, "html", func(dest string) error {
		return storage.WriteHTML(file, dest)
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(project, r), "version": version})
}

// publishFolder 上传文件夹中的多文件构建产物并创建新版本。
func (a *App) publishFolder(w http.ResponseWriter, r *http.Request, project model.Project) {
	manifest, files, cleanup, err := readFolderUpload(r, a.cfg.MaxUploadBytes)
	if cleanup != nil {
		defer cleanup()
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	project, version, err := a.createPublishedVersion(project, currentUser(r).ID, "folder", func(dest string) error {
		return writeFolderUpload(dest, manifest, files)
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(project, r), "version": version})
}

// createPublishedVersion 创建版本目录、执行写入、分析 base URL 并更新项目访问模式。
func (a *App) createPublishedVersion(project model.Project, userID int64, sourceType string, writer func(dest string) error) (model.Project, model.ProjectVersion, error) {
	version, err := a.store.InsertVersion(project.ID, sourceType, "", 0, "", nil, userID)
	if err != nil {
		return project, version, err
	}
	versionPath, err := a.files.PrepareVersionDir(project.ID, version.ID)
	if err != nil {
		return project, version, err
	}
	if err := writer(versionPath); err != nil {
		_ = os.RemoveAll(versionPath)
		return project, version, err
	}
	analysis := analyzer.Analyze(versionPath, project.EntryFile)
	size, _ := storage.DirSize(versionPath)
	version, err = a.replaceVersionMetadata(version, versionPath, size, analysis.DetectedBaseURL, analysis.Warnings)
	if err != nil {
		return project, version, err
	}
	project.CurrentVersionID = version.ID
	project.DetectedBaseURL = analysis.DetectedBaseURL
	if err := a.applyRecommendedAccess(&project, analysis); err != nil {
		return project, version, err
	}
	project, err = a.store.UpdateProjectSettings(project)
	if err != nil {
		return project, version, err
	}
	_ = a.syncProjectRuntime(project)
	if err := a.pruneProjectVersionHistory(project); err != nil {
		log.Printf("自动清理历史版本失败: project=%d err=%v", project.ID, err)
	}
	return project, version, nil
}

// replaceVersionMetadata 补写版本目录、大小和分析结果。
func (a *App) replaceVersionMetadata(version model.ProjectVersion, storagePath string, size int64, detectedBaseURL string, warnings []string) (model.ProjectVersion, error) {
	return a.store.UpdateVersionMetadata(version.ID, storagePath, size, detectedBaseURL, warnings)
}

// applyRecommendedAccess 根据 base URL 分析结果选择默认访问模式。
func (a *App) applyRecommendedAccess(project *model.Project, analysis model.BaseAnalysis) error {
	switch analysis.RecommendedMode {
	case model.AccessMount:
		mount := analysis.RecommendedMount
		if mount != "" && a.validateMountPath(mount) == nil {
			project.MountPath = mount
			project.AccessMode = model.AccessMount
			if !project.Active || a.validateActiveMountPath(mount, project.ID) == nil {
				return nil
			}
		}
		fallthrough
	case model.AccessPort:
		project.AccessMode = model.AccessPort
		return a.ensureProjectPort(project, !a.projectServerRunning(project.ID))
	default:
		project.AccessMode = model.AccessPath
	}
	return nil
}

// handleFiles 实现文件列表、上传/替换、删除和下载。
func (a *App) handleFiles(w http.ResponseWriter, r *http.Request, project model.Project) {
	version, err := a.store.CurrentVersion(project)
	if err != nil {
		notFoundOrError(w, err, "当前项目没有版本")
		return
	}
	projectPath := r.URL.Query().Get("path")
	if strings.HasSuffix(r.URL.Path, "/download") && r.Method == http.MethodGet {
		a.downloadFile(w, r, version.StoragePath, projectPath)
		return
	}
	switch r.Method {
	case http.MethodGet:
		entries, err := storage.ListFiles(version.StoragePath, projectPath)
		if err != nil {
			writeError(w, http.StatusBadRequest, "读取目录失败")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"files": entries})
	case http.MethodPut:
		a.updateFileVersion(w, r, project, version, projectPath, false)
	case http.MethodDelete:
		a.updateFileVersion(w, r, project, version, projectPath, true)
	default:
		writeError(w, http.StatusMethodNotAllowed, "方法不允许")
	}
}

// updateFileVersion 基于当前版本复制出新版本，并应用文件写入或删除。
func (a *App) updateFileVersion(w http.ResponseWriter, r *http.Request, project model.Project, current model.ProjectVersion, projectPath string, deleteMode bool) {
	if strings.TrimSpace(projectPath) == "" {
		writeError(w, http.StatusBadRequest, "文件路径不能为空")
		return
	}
	version, err := a.store.InsertVersion(project.ID, "file", "", 0, "", nil, currentUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建版本失败")
		return
	}
	versionPath, err := a.files.PrepareVersionDir(project.ID, version.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建版本目录失败")
		return
	}
	if err := storage.CopyDir(current.StoragePath, versionPath); err != nil {
		writeError(w, http.StatusInternalServerError, "复制当前版本失败")
		return
	}
	if deleteMode {
		err = storage.DeletePath(versionPath, projectPath)
	} else {
		err = storage.WriteFile(versionPath, projectPath, r.Body)
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	analysis := analyzer.Analyze(versionPath, project.EntryFile)
	size, _ := storage.DirSize(versionPath)
	version, err = a.replaceVersionMetadata(version, versionPath, size, analysis.DetectedBaseURL, analysis.Warnings)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存版本失败")
		return
	}
	project.CurrentVersionID = version.ID
	project.DetectedBaseURL = analysis.DetectedBaseURL
	project, err = a.store.UpdateProjectSettings(project)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "激活版本失败")
		return
	}
	if err := a.pruneProjectVersionHistory(project); err != nil {
		log.Printf("自动清理历史版本失败: project=%d err=%v", project.ID, err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(project, r), "version": version})
}

// downloadFile 下载当前版本中的单个文件。
func (a *App) downloadFile(w http.ResponseWriter, r *http.Request, root, projectPath string) {
	path, err := storage.SafeJoin(root, projectPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		writeError(w, http.StatusNotFound, "文件不存在")
		return
	}
	http.ServeFile(w, r, path)
}

// readUploadFile 从 multipart 请求读取 file 字段，并限制总大小。
func readUploadFile(r *http.Request, limit int64) (multipart.File, *multipart.FileHeader, error) {
	r.Body = http.MaxBytesReader(nil, r.Body, limit)
	if err := r.ParseMultipartForm(limit); err != nil {
		return nil, nil, uploadParseError(limit, err)
	}
	file, header, err := r.FormFile("file")
	return file, header, err
}

// uploadParseError 将 Go multipart 底层错误转换为用户可理解的中文提示。
func uploadParseError(limit int64, err error) error {
	message := err.Error()
	if strings.Contains(message, "http: request body too large") {
		return fmt.Errorf("上传内容超过限制，当前最大 %d MB", limit/1024/1024)
	}
	if strings.Contains(message, "multipart: message too large") {
		return errors.New("上传文件数量过多或表单内容过大，请改用 ZIP 上传或减少文件数量")
	}
	return err
}

// folderUploadManifest 描述文件夹上传中的文件字段和项目内相对路径。
type folderUploadManifest struct {
	Files []folderUploadFile `json:"files"`
}

// folderUploadFile 表示文件夹上传中的单个文件。
type folderUploadFile struct {
	Field string `json:"field"`
	Path  string `json:"path"`
	Size  int64  `json:"size"`
}

// readFolderUpload 解析文件夹上传请求，校验 manifest、文件字段和安全路径。
func readFolderUpload(r *http.Request, limit int64) (folderUploadManifest, map[string][]*multipart.FileHeader, func(), error) {
	r.Body = http.MaxBytesReader(nil, r.Body, limit)
	if err := r.ParseMultipartForm(limit); err != nil {
		return folderUploadManifest{}, nil, nil, uploadParseError(limit, err)
	}
	cleanup := func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}
	if r.MultipartForm == nil {
		return folderUploadManifest{}, nil, cleanup, errors.New("上传内容为空")
	}
	values := r.MultipartForm.Value["manifest"]
	if len(values) == 0 || strings.TrimSpace(values[0]) == "" {
		return folderUploadManifest{}, nil, cleanup, errors.New("文件夹清单不能为空")
	}
	var manifest folderUploadManifest
	if err := json.Unmarshal([]byte(values[0]), &manifest); err != nil {
		return folderUploadManifest{}, nil, cleanup, errors.New("文件夹清单格式错误")
	}
	if len(manifest.Files) == 0 {
		return folderUploadManifest{}, nil, cleanup, errors.New("文件夹内没有可上传文件")
	}
	if err := normalizeFolderManifest(&manifest, r.MultipartForm.File); err != nil {
		return folderUploadManifest{}, nil, cleanup, err
	}
	return manifest, r.MultipartForm.File, cleanup, nil
}

// normalizeFolderManifest 清理路径、去掉单层根目录并验证文件字段完整性。
func normalizeFolderManifest(manifest *folderUploadManifest, formFiles map[string][]*multipart.FileHeader) error {
	for i := range manifest.Files {
		manifest.Files[i].Field = strings.TrimSpace(manifest.Files[i].Field)
		if manifest.Files[i].Field == "" {
			return errors.New("文件字段不能为空")
		}
		if manifest.Files[i].Size < 0 {
			return errors.New("文件大小无效")
		}
		rawPath := strings.TrimSpace(strings.ReplaceAll(manifest.Files[i].Path, "\\", "/"))
		if rawPath == "" || strings.HasPrefix(rawPath, "/") || filepath.IsAbs(rawPath) || strings.Contains(strings.Split(rawPath, "/")[0], ":") {
			return errors.New("非法项目路径")
		}
		cleaned, err := storage.CleanProjectPath(manifest.Files[i].Path)
		if err != nil {
			return err
		}
		if cleaned == "" {
			return errors.New("文件路径不能为空")
		}
		manifest.Files[i].Path = cleaned
	}
	stripFolderManifestRoot(manifest)
	seen := make(map[string]bool, len(manifest.Files))
	for _, item := range manifest.Files {
		if seen[item.Path] {
			return fmt.Errorf("文件路径重复: %s", item.Path)
		}
		seen[item.Path] = true
		headers := formFiles[item.Field]
		if len(headers) != 1 {
			return fmt.Errorf("缺少上传文件: %s", item.Path)
		}
		if headers[0].Size != item.Size {
			return fmt.Errorf("文件大小不匹配: %s", item.Path)
		}
	}
	return nil
}

// stripFolderManifestRoot 在需要时去掉浏览器文件夹选择带来的单层根目录。
func stripFolderManifestRoot(manifest *folderUploadManifest) {
	if folderManifestHasPath(manifest, "index.html") {
		return
	}
	root := ""
	for _, item := range manifest.Files {
		head, _, ok := strings.Cut(item.Path, "/")
		if !ok {
			return
		}
		if root == "" {
			root = head
			continue
		}
		if root != head {
			return
		}
	}
	if root == "" || !folderManifestHasPath(manifest, root+"/index.html") {
		return
	}
	prefix := root + "/"
	for i := range manifest.Files {
		manifest.Files[i].Path = strings.TrimPrefix(manifest.Files[i].Path, prefix)
	}
}

// folderManifestHasPath 判断清单中是否存在指定路径。
func folderManifestHasPath(manifest *folderUploadManifest, path string) bool {
	for _, item := range manifest.Files {
		if item.Path == path {
			return true
		}
	}
	return false
}

// writeFolderUpload 按 manifest 将多个文件写入同一个版本目录。
func writeFolderUpload(dest string, manifest folderUploadManifest, formFiles map[string][]*multipart.FileHeader) error {
	for _, item := range manifest.Files {
		src, err := formFiles[item.Field][0].Open()
		if err != nil {
			return err
		}
		err = storage.WriteFile(dest, item.Path, src)
		closeErr := src.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
	}
	return nil
}
