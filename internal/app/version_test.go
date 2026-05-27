// 文件功能描述：验证项目版本删除、当前版本回退和版本文件清理行为。
package app

import (
	"bytes"
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

// TestAutoPruneKeepsPinnedVersions 验证自动清理只删除超过数量的未固定历史版本。
func TestAutoPruneKeepsPinnedVersions(t *testing.T) {
	app := newPublishTestApp(t)
	defer app.store.Close()
	project := createPublishTestProject(t, app, "prune-version")

	versions := make([]model.ProjectVersion, 0, 13)
	for i := 1; i <= 13; i++ {
		versions = append(versions, createVersionForDeleteTest(t, app, project, fmt.Sprintf("version-%02d", i), "/"))
	}
	pinVersionForTest(t, app, project, versions[0].ID, true)
	project.CurrentVersionID = versions[len(versions)-1].ID
	project.DetectedBaseURL = versions[len(versions)-1].DetectedBaseURL
	var err error
	project, err = app.store.UpdateProjectSettings(project)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.pruneProjectVersionHistory(project); err != nil {
		t.Fatal(err)
	}

	remaining, err := app.store.ListVersions(project.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(remaining) != 12 {
		t.Fatalf("剩余版本数 = %d, want 12", len(remaining))
	}
	pinned, err := app.store.VersionByID(versions[0].ID)
	if err != nil {
		t.Fatalf("固定版本被误删: %v", err)
	}
	if !pinned.Pinned {
		t.Fatal("expected oldest version to stay pinned")
	}
	if _, err := app.store.VersionByID(versions[1].ID); err == nil {
		t.Fatal("expected oldest unpinned history version to be pruned")
	}
	if _, err := os.Stat(versions[1].StoragePath); !os.IsNotExist(err) {
		t.Fatalf("自动删除版本目录后 stat err = %v, want not exist", err)
	}
	unpinnedHistory := 0
	for _, version := range remaining {
		if version.ID != project.CurrentVersionID && !version.Pinned {
			unpinnedHistory++
		}
	}
	if unpinnedHistory != maxAutoHistoryVersions {
		t.Fatalf("未固定历史版本数 = %d, want %d", unpinnedHistory, maxAutoHistoryVersions)
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

// pinVersionForTest 通过版本 API 设置固定状态。
func pinVersionForTest(t *testing.T, app *App, project model.Project, versionID int64, pinned bool) {
	t.Helper()
	body := []byte(fmt.Sprintf(`{"pinned":%t}`, pinned))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/projects/%d/versions/%d", project.ID, versionID), bytes.NewReader(body))
	app.handleVersions(recorder, request, project, []string{fmt.Sprint(versionID)})
	if recorder.Code != http.StatusOK {
		t.Fatalf("固定版本状态码 = %d, want %d, body %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
}
