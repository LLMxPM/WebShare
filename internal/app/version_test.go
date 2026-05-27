// 文件功能描述：验证项目版本删除、当前版本回退和版本文件清理行为。
package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"webshare/internal/model"
)

// TestDeleteCurrentVersionFallsBackAndClearsLast 验证删除当前版本会回退，删除最后版本会清空当前版本。
func TestDeleteCurrentVersionFallsBackAndClearsLast(t *testing.T) {
	app := newPublishTestApp(t)
	defer app.store.Close()
	project := createPublishTestProject(t, app, "delete-version")

	first := createVersionForDeleteTest(t, app, project, "first", "/")
	second := createVersionForDeleteTest(t, app, project, "second", "/demo/")
	project.CurrentVersionID = second.ID
	project.DetectedBaseURL = second.DetectedBaseURL
	project, err := app.store.UpdateProjectSettings(project)
	if err != nil {
		t.Fatal(err)
	}

	deleteVersionForTest(t, app, project, second.ID)
	latest, err := app.store.ProjectByID(project.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest.CurrentVersionID != first.ID {
		t.Fatalf("当前版本 = %d, want %d", latest.CurrentVersionID, first.ID)
	}
	if latest.DetectedBaseURL != first.DetectedBaseURL {
		t.Fatalf("BaseURL = %q, want %q", latest.DetectedBaseURL, first.DetectedBaseURL)
	}
	if _, err := os.Stat(second.StoragePath); !os.IsNotExist(err) {
		t.Fatalf("删除版本目录后 stat err = %v, want not exist", err)
	}

	deleteVersionForTest(t, app, latest, first.ID)
	latest, err = app.store.ProjectByID(project.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest.CurrentVersionID != 0 {
		t.Fatalf("最后版本删除后当前版本 = %d, want 0", latest.CurrentVersionID)
	}
	if latest.DetectedBaseURL != "" {
		t.Fatalf("最后版本删除后 BaseURL = %q, want empty", latest.DetectedBaseURL)
	}
}

// createVersionForDeleteTest 创建带 index.html 的测试版本。
func createVersionForDeleteTest(t *testing.T, app *App, project model.Project, body string, baseURL string) model.ProjectVersion {
	t.Helper()
	version, err := app.store.InsertVersion(project.ID, "html", "", 0, "", nil, 1)
	if err != nil {
		t.Fatal(err)
	}
	versionPath, err := app.files.PrepareVersionDir(project.ID, version.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(versionPath, "index.html"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	version, err = app.replaceVersionMetadata(version, versionPath, int64(len(body)), baseURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	return version
}

// deleteVersionForTest 通过版本 API 删除指定版本。
func deleteVersionForTest(t *testing.T, app *App, project model.Project, versionID int64) {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/projects/%d/versions/%d", project.ID, versionID), nil)
	app.handleVersions(recorder, request, project, []string{fmt.Sprint(versionID)})
	if recorder.Code != http.StatusOK {
		t.Fatalf("删除版本状态码 = %d, want %d, body %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
}
