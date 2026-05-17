// 文件功能描述：验证项目发布接口，包括文件夹构建产物上传和路径安全校验。
package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"webshare/internal/config"
	"webshare/internal/model"
)

type folderUploadTestFile struct {
	Field   string
	Path    string
	Content string
}

// TestPublishFolderCreatesSingleVersion 验证文件夹上传会去掉单层根目录并只创建一个版本。
func TestPublishFolderCreatesSingleVersion(t *testing.T) {
	app := newPublishTestApp(t)
	defer app.store.Close()
	project := createPublishTestProject(t, app, "folder-upload")

	request := folderUploadTestRequest(t, []folderUploadTestFile{
		{Field: "file_0", Path: "dist/index.html", Content: `<script type="module" src="./assets/app.js"></script>`},
		{Field: "file_1", Path: "dist/assets/app.js", Content: `console.log("ok")`},
	})
	recorder := httptest.NewRecorder()
	app.publishFolder(recorder, request, project)

	if recorder.Code != http.StatusOK {
		t.Fatalf("文件夹发布状态码 = %d, want %d, body %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	versions, err := app.store.ListVersions(project.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(versions) != 1 {
		t.Fatalf("版本数量 = %d, want 1", len(versions))
	}
	version := versions[0]
	if version.SourceType != "folder" {
		t.Fatalf("版本来源 = %s, want folder", version.SourceType)
	}
	if version.SizeBytes == 0 {
		t.Fatal("expected version size to be recorded")
	}
	latest, err := app.store.ProjectByID(project.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest.CurrentVersionID != version.ID {
		t.Fatalf("当前版本 = %d, want %d", latest.CurrentVersionID, version.ID)
	}
	assertFileContent(t, filepath.Join(version.StoragePath, "index.html"), `<script type="module" src="./assets/app.js"></script>`)
	assertFileContent(t, filepath.Join(version.StoragePath, "assets", "app.js"), `console.log("ok")`)
	if _, err := os.Stat(filepath.Join(version.StoragePath, "dist", "index.html")); !os.IsNotExist(err) {
		t.Fatalf("expected dist root to be stripped, stat err: %v", err)
	}
}

// TestPublishFolderRejectsUnsafePaths 验证文件夹上传拒绝空路径、绝对路径和路径穿越。
func TestPublishFolderRejectsUnsafePaths(t *testing.T) {
	cases := []struct {
		name string
		path string
	}{
		{name: "parent", path: "../x.js"},
		{name: "absolute", path: "/x.js"},
		{name: "empty", path: ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := newPublishTestApp(t)
			defer app.store.Close()
			project := createPublishTestProject(t, app, "unsafe-"+tc.name)

			request := folderUploadTestRequest(t, []folderUploadTestFile{
				{Field: "file_0", Path: tc.path, Content: "bad"},
			})
			recorder := httptest.NewRecorder()
			app.publishFolder(recorder, request, project)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("非法路径状态码 = %d, want %d", recorder.Code, http.StatusBadRequest)
			}
			versions, err := app.store.ListVersions(project.ID)
			if err != nil {
				t.Fatal(err)
			}
			if len(versions) != 0 {
				t.Fatalf("非法上传不应创建版本，got %d", len(versions))
			}
		})
	}
}

// newPublishTestApp 创建带上传限制的发布测试应用。
func newPublishTestApp(t *testing.T) *App {
	t.Helper()
	app, err := New(config.Config{
		DataDir:           t.TempDir(),
		PublicHost:        "localhost",
		PublicScheme:      "http",
		MaxUploadBytes:    10 * 1024 * 1024,
		InitAdminUser:     "admin",
		InitAdminPassword: "password-for-test",
	})
	if err != nil {
		t.Fatal(err)
	}
	return app
}

// createPublishTestProject 创建发布测试项目。
func createPublishTestProject(t *testing.T, app *App, slug string) model.Project {
	t.Helper()
	project, err := app.store.CreateProject(1, "发布测试 "+slug, slug, nil)
	if err != nil {
		t.Fatal(err)
	}
	return project
}

// folderUploadTestRequest 构造带 manifest 和多文件字段的文件夹上传请求。
func folderUploadTestRequest(t *testing.T, files []folderUploadTestFile) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	manifest := folderUploadManifest{Files: make([]folderUploadFile, 0, len(files))}
	for _, file := range files {
		manifest.Files = append(manifest.Files, folderUploadFile{
			Field: file.Field,
			Path:  file.Path,
			Size:  int64(len(file.Content)),
		})
	}
	rawManifest, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("manifest", string(rawManifest)); err != nil {
		t.Fatal(err)
	}
	for i, file := range files {
		part, err := writer.CreateFormFile(file.Field, fmt.Sprintf("upload-%d", i))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write([]byte(file.Content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/projects/1/publish/folder", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	user := model.User{ID: 1, Role: model.RoleAdmin}
	return request.WithContext(context.WithValue(request.Context(), userContextKey, user))
}

// assertFileContent 验证指定文件内容。
func assertFileContent(t *testing.T, path string, want string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != want {
		t.Fatalf("%s 内容 = %q, want %q", path, string(data), want)
	}
}
