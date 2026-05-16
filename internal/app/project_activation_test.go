// 文件功能描述：验证项目整体激活、停用和访问冲突校验行为。
package app

import (
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"static-host/internal/config"
	"static-host/internal/model"
)

// TestInactiveMountCanDuplicateButActivationConflicts 验证停用项目可保存重复挂载路径，但激活时会被拦截。
func TestInactiveMountCanDuplicateButActivationConflicts(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()

	active := createActivationTestProject(t, app, "active-mount")
	active.MountPath = "/demo/"
	active.AccessMode = model.AccessMount
	if err := app.prepareProjectAccess(&active); err != nil {
		t.Fatal(err)
	}
	if _, err := app.store.UpdateProjectSettings(active); err != nil {
		t.Fatal(err)
	}

	inactive := createActivationTestProject(t, app, "inactive-mount")
	inactive.Active = false
	inactive.MountPath = "/demo/"
	inactive.AccessMode = model.AccessMount
	if err := app.prepareProjectAccess(&inactive); err != nil {
		t.Fatal(err)
	}
	inactive, err := app.store.UpdateProjectSettings(inactive)
	if err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/projects/2/activate", nil)
	app.activateProject(recorder, request, inactive)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected activation conflict, got %d", recorder.Code)
	}
	latest, err := app.store.ProjectByID(inactive.ID)
	if err != nil {
		t.Fatal(err)
	}
	if latest.Active {
		t.Fatal("expected project to remain inactive after failed activation")
	}
}

// TestInactivePortStillReservesPort 验证停用项目上的端口仍然占用全局端口配置。
func TestInactivePortStillReservesPort(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()

	first := createActivationTestProject(t, app, "inactive-port-one")
	first.Active = false
	first.AccessMode = model.AccessPort
	if err := app.prepareProjectAccess(&first); err != nil {
		t.Fatal(err)
	}
	if _, err := app.store.UpdateProjectSettings(first); err != nil {
		t.Fatal(err)
	}

	second := createActivationTestProject(t, app, "inactive-port-two")
	second.Active = false
	second.AccessMode = model.AccessPort
	second.Port = first.Port
	if err := app.prepareProjectAccess(&second); err == nil {
		t.Fatal("expected duplicate inactive port to be rejected")
	}
}

// TestDeactivatingPortProjectStopsServer 验证停用端口项目会停止独立端口服务。
func TestDeactivatingPortProjectStopsServer(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()

	project := createActivationTestProject(t, app, "active-port")
	project.AccessMode = model.AccessPort
	if err := app.prepareProjectAccess(&project); err != nil {
		t.Fatal(err)
	}
	project, err := app.store.UpdateProjectSettings(project)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.syncProjectRuntime(project); err != nil {
		t.Fatal(err)
	}
	if !app.projectServerRunning(project.ID) {
		t.Fatal("expected project server to be running")
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/projects/1/deactivate", nil)
	app.deactivateProject(recorder, request, project)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected deactivate success, got %d", recorder.Code)
	}
	if app.projectServerRunning(project.ID) {
		t.Fatal("expected project server to stop")
	}
}

// TestInactiveProjectCannotBeServed 验证停用项目不会通过分享网关对外服务。
func TestInactiveProjectCannotBeServed(t *testing.T) {
	app := newActivationTestApp(t)
	defer app.store.Close()

	project := createActivationTestProject(t, app, "inactive-share")
	version, err := app.store.InsertVersion(project.ID, "html", "", 0, "", nil, 1)
	if err != nil {
		t.Fatal(err)
	}
	versionPath, err := app.files.PrepareVersionDir(project.ID, version.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(versionPath, "index.html"), []byte("ok"), 0o644); err != nil {
		t.Fatal(err)
	}
	version, err = app.replaceVersionMetadata(version, versionPath, 2, ".", nil)
	if err != nil {
		t.Fatal(err)
	}
	project.CurrentVersionID = version.ID
	project.Active = false
	project, err = app.store.UpdateProjectSettings(project)
	if err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/p/"+project.Slug+"/", nil)
	app.shareHandler().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected inactive project to be forbidden, got %d", recorder.Code)
	}
}

// newActivationTestApp 创建独立端口池范围内的测试应用。
func newActivationTestApp(t *testing.T) *App {
	t.Helper()
	start := freeActivationTestPort(t)
	app, err := New(config.Config{
		DataDir:           t.TempDir(),
		PublicHost:        "localhost",
		PublicScheme:      "http",
		PortStart:         start,
		PortEnd:           start,
		InitAdminUser:     "admin",
		InitAdminPassword: "password-for-test",
	})
	if err != nil {
		t.Fatal(err)
	}
	return app
}

// createActivationTestProject 创建测试项目并保持默认激活状态。
func createActivationTestProject(t *testing.T, app *App, slug string) model.Project {
	t.Helper()
	project, err := app.store.CreateProject(1, slug, slug)
	if err != nil {
		t.Fatal(err)
	}
	return project
}

// freeActivationTestPort 返回当前机器上一个可用端口作为测试端口池起点。
func freeActivationTestPort(t *testing.T) int {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	return listener.Addr().(*net.TCPAddr).Port
}
