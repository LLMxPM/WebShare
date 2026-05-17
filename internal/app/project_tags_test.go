// 文件功能描述：验证项目标签创建、更新、清空和服务端校验行为。
package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

// TestProjectTagsCreateUpdateAndClear 验证项目标签会随项目创建和设置保存，并支持清空。
func TestProjectTagsCreateUpdateAndClear(t *testing.T) {
	app := newAccountTestApp(t)
	defer app.store.Close()
	cookie := loginAccountTestUser(t, app, "admin", "password-for-test")

	create := httptest.NewRecorder()
	createReq := accountJSONRequest(t, http.MethodPost, "/api/projects", map[string]any{
		"name": "标签项目",
		"tags": []string{" 客户A ", "演示", "客户A", ""},
	})
	createReq.AddCookie(cookie)
	app.adminHandler().ServeHTTP(create, createReq)
	if create.Code != http.StatusCreated {
		t.Fatalf("expected create success, got %d body=%s", create.Code, create.Body.String())
	}
	project := decodeProjectTagsResponse(t, create.Body.Bytes())
	if !slices.Equal(project.Tags, []string{"客户A", "演示"}) {
		t.Fatalf("unexpected created tags: %v", project.Tags)
	}

	rename := httptest.NewRecorder()
	renameReq := accountJSONRequest(t, http.MethodPatch, fmt.Sprintf("/api/projects/%d", project.ID), map[string]any{
		"name": "标签项目重命名",
	})
	renameReq.AddCookie(cookie)
	app.adminHandler().ServeHTTP(rename, renameReq)
	if rename.Code != http.StatusOK {
		t.Fatalf("expected name update success, got %d body=%s", rename.Code, rename.Body.String())
	}
	project = decodeProjectTagsResponse(t, rename.Body.Bytes())
	if !slices.Equal(project.Tags, []string{"客户A", "演示"}) {
		t.Fatalf("expected missing tags field to keep tags, got %v", project.Tags)
	}

	update := httptest.NewRecorder()
	updateReq := accountJSONRequest(t, http.MethodPatch, fmt.Sprintf("/api/projects/%d", project.ID), map[string]any{
		"tags": []string{"生产", "production", "PRODUCTION"},
	})
	updateReq.AddCookie(cookie)
	app.adminHandler().ServeHTTP(update, updateReq)
	if update.Code != http.StatusOK {
		t.Fatalf("expected tags update success, got %d body=%s", update.Code, update.Body.String())
	}
	project = decodeProjectTagsResponse(t, update.Body.Bytes())
	if !slices.Equal(project.Tags, []string{"生产", "production"}) {
		t.Fatalf("unexpected updated tags: %v", project.Tags)
	}

	clear := httptest.NewRecorder()
	clearReq := accountJSONRequest(t, http.MethodPatch, fmt.Sprintf("/api/projects/%d", project.ID), map[string]any{"tags": []string{}})
	clearReq.AddCookie(cookie)
	app.adminHandler().ServeHTTP(clear, clearReq)
	if clear.Code != http.StatusOK {
		t.Fatalf("expected tags clear success, got %d body=%s", clear.Code, clear.Body.String())
	}
	project = decodeProjectTagsResponse(t, clear.Body.Bytes())
	if len(project.Tags) != 0 {
		t.Fatalf("expected tags to be cleared, got %v", project.Tags)
	}
}

// TestProjectTagsValidation 验证项目标签数量和单个标签长度限制。
func TestProjectTagsValidation(t *testing.T) {
	app := newAccountTestApp(t)
	defer app.store.Close()
	cookie := loginAccountTestUser(t, app, "admin", "password-for-test")

	longTag := strings.Repeat("a", 33)
	longReq := accountJSONRequest(t, http.MethodPost, "/api/projects", map[string]any{
		"name": "过长标签",
		"tags": []string{longTag},
	})
	longReq.AddCookie(cookie)
	longResp := httptest.NewRecorder()
	app.adminHandler().ServeHTTP(longResp, longReq)
	if longResp.Code != http.StatusBadRequest {
		t.Fatalf("expected long tag to be rejected, got %d", longResp.Code)
	}

	manyTags := make([]string, 21)
	for i := range manyTags {
		manyTags[i] = fmt.Sprintf("tag-%02d", i)
	}
	manyReq := accountJSONRequest(t, http.MethodPost, "/api/projects", map[string]any{
		"name": "过多标签",
		"tags": manyTags,
	})
	manyReq.AddCookie(cookie)
	manyResp := httptest.NewRecorder()
	app.adminHandler().ServeHTTP(manyResp, manyReq)
	if manyResp.Code != http.StatusBadRequest {
		t.Fatalf("expected too many tags to be rejected, got %d", manyResp.Code)
	}
}

type projectTagsResponse struct {
	Project projectTagsResponseProject `json:"project"`
}

type projectTagsResponseProject struct {
	ID   int64    `json:"id"`
	Tags []string `json:"tags"`
}

// decodeProjectTagsResponse 解析项目标签测试中关心的响应字段。
func decodeProjectTagsResponse(t *testing.T, data []byte) projectTagsResponseProject {
	t.Helper()
	var resp projectTagsResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		t.Fatal(err)
	}
	return resp.Project
}
