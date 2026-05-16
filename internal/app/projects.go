// 文件功能描述：实现项目管理 API，包括创建、更新、删除、版本回滚和访问地址生成。
package app

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"static-host/internal/model"
	"static-host/internal/security"
)

// handleProjects 分发项目相关 API。
func (a *App) handleProjects(w http.ResponseWriter, r *http.Request, tail string) {
	tail = strings.Trim(tail, "/")
	if tail == "" {
		switch r.Method {
		case http.MethodGet:
			a.listProjects(w, r)
		case http.MethodPost:
			a.createProject(w, r)
		default:
			writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		}
		return
	}

	parts := strings.Split(tail, "/")
	id, ok := parseID(parts[0])
	if !ok {
		writeError(w, http.StatusBadRequest, "项目 ID 无效")
		return
	}
	project, err := a.store.ProjectByID(id)
	if err != nil {
		notFoundOrError(w, err, "查询项目失败")
		return
	}
	if !canManageProject(currentUser(r), project) {
		writeError(w, http.StatusForbidden, "无权访问该项目")
		return
	}
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(project, r)})
		case http.MethodPatch:
			a.updateProject(w, r, project)
		case http.MethodDelete:
			a.deleteProject(w, r, project)
		default:
			writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		}
		return
	}

	switch parts[1] {
	case "activate":
		a.activateProject(w, r, project)
	case "deactivate":
		a.deactivateProject(w, r, project)
	case "publish":
		a.handlePublish(w, r, project, parts[2:])
	case "packages":
		a.handlePackages(w, r, project, parts[2:])
	case "versions":
		a.handleVersions(w, r, project, parts[2:])
	case "files":
		a.handleFiles(w, r, project)
	case "share-token":
		a.regenerateShareToken(w, r, project)
	default:
		writeError(w, http.StatusNotFound, "接口不存在")
	}
}

// listProjects 返回当前用户可管理的项目列表。
func (a *App) listProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := a.store.ListProjects(currentUser(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "查询项目失败")
		return
	}
	items := make([]model.ProjectDTO, 0, len(projects))
	for _, project := range projects {
		items = append(items, a.projectDTO(project, r))
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": items})
}

// createProject 创建项目并返回可用访问地址。
func (a *App) createProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := strings.TrimSpace(req.Slug)
	if name == "" {
		writeError(w, http.StatusBadRequest, "项目名称不能为空")
		return
	}
	if slug == "" {
		var err error
		slug, err = a.generateUniqueSlug(name)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "生成项目标识失败")
			return
		}
	}
	if err := a.validateSlug(slug, 0); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	project, err := a.store.CreateProject(currentUser(r).ID, name, slug)
	if err != nil {
		writeError(w, http.StatusBadRequest, "创建项目失败")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"project": a.projectDTO(project, r)})
}

// updateProject 更新项目基础设置、分享状态和访问模式。
func (a *App) updateProject(w http.ResponseWriter, r *http.Request, project model.Project) {
	var req struct {
		Name       *string `json:"name"`
		Slug       *string `json:"slug"`
		ShareState *string `json:"shareState"`
		EntryFile  *string `json:"entryFile"`
		SPAEnabled *bool   `json:"spaEnabled"`
		MountPath  *string `json:"mountPath"`
		AccessMode *string `json:"accessMode"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if req.Name != nil {
		project.Name = strings.TrimSpace(*req.Name)
		if project.Name == "" {
			writeError(w, http.StatusBadRequest, "项目名称不能为空")
			return
		}
	}
	if req.Slug != nil {
		slug := strings.TrimSpace(*req.Slug)
		if err := a.validateSlug(slug, project.ID); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		project.Slug = slug
	}
	if req.ShareState != nil {
		state, err := normalizeShareState(*req.ShareState)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		project.ShareState = state
	}
	if req.EntryFile != nil && strings.TrimSpace(*req.EntryFile) != "" {
		project.EntryFile = strings.Trim(strings.ReplaceAll(*req.EntryFile, "\\", "/"), "/")
	}
	if req.SPAEnabled != nil {
		project.SPAEnabled = *req.SPAEnabled
	}
	if req.MountPath != nil {
		project.MountPath = strings.TrimSpace(*req.MountPath)
		if project.MountPath != "" && !strings.HasSuffix(project.MountPath, "/") {
			project.MountPath += "/"
		}
		if err := a.validateMountPath(project.MountPath); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	if req.AccessMode != nil {
		mode, err := normalizeAccessMode(*req.AccessMode)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := a.applyAccessMode(&project, mode); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	if err := a.prepareProjectAccess(&project); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, err := a.store.UpdateProjectSettings(project)
	if err != nil {
		writeError(w, http.StatusBadRequest, "更新项目失败")
		return
	}
	if err := a.syncProjectRuntime(updated); err != nil {
		writeError(w, http.StatusBadRequest, "应用项目运行状态失败: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(updated, r)})
}

// applyAccessMode 根据用户指定模式补齐端口或挂载路径约束。
func (a *App) applyAccessMode(project *model.Project, mode string) error {
	switch mode {
	case model.AccessPath:
		project.AccessMode = model.AccessPath
	case model.AccessMount:
		project.AccessMode = model.AccessMount
	case model.AccessPort:
		project.AccessMode = model.AccessPort
	}
	return nil
}

// prepareProjectAccess 根据当前激活状态校验挂载路径或端口，并补齐端口。
func (a *App) prepareProjectAccess(project *model.Project) error {
	switch project.AccessMode {
	case model.AccessMount:
		if project.MountPath == "" {
			return errors.New("挂载路径模式需要先设置 mountPath")
		}
		if project.Active {
			return a.validateActiveMountPath(project.MountPath, project.ID)
		}
		return a.validateMountPath(project.MountPath)
	case model.AccessPort:
		return a.ensureProjectPort(project, !a.projectServerRunning(project.ID))
	default:
		return nil
	}
}

// syncProjectRuntime 根据项目激活状态启动或停止独立端口服务。
func (a *App) syncProjectRuntime(project model.Project) error {
	if project.Active && project.AccessMode == model.AccessPort && project.Port > 0 {
		return a.startProjectServer(project)
	}
	a.stopProjectServer(project.ID)
	return nil
}

// activateProject 激活项目，激活前执行访问模式冲突校验。
func (a *App) activateProject(w http.ResponseWriter, r *http.Request, project model.Project) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}
	project.Active = true
	if err := a.prepareProjectAccess(&project); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, err := a.store.UpdateProjectSettings(project)
	if err != nil {
		writeError(w, http.StatusBadRequest, "激活项目失败")
		return
	}
	if err := a.syncProjectRuntime(updated); err != nil {
		updated.Active = false
		_, _ = a.store.UpdateProjectSettings(updated)
		a.stopProjectServer(updated.ID)
		writeError(w, http.StatusBadRequest, "启动项目失败: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(updated, r)})
}

// deactivateProject 停用项目并停止独立端口服务。
func (a *App) deactivateProject(w http.ResponseWriter, r *http.Request, project model.Project) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}
	project.Active = false
	updated, err := a.store.UpdateProjectSettings(project)
	if err != nil {
		writeError(w, http.StatusBadRequest, "停用项目失败")
		return
	}
	a.stopProjectServer(updated.ID)
	writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(updated, r)})
}

// deleteProject 删除项目元数据、文件和独立端口监听。
func (a *App) deleteProject(w http.ResponseWriter, r *http.Request, project model.Project) {
	a.stopProjectServer(project.ID)
	if err := a.store.DeleteProject(project.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "删除项目失败")
		return
	}
	_ = a.files.DeleteProjectFiles(project.ID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// regenerateShareToken 生成新的分享令牌；明文只在本次响应中返回。
func (a *App) regenerateShareToken(w http.ResponseWriter, r *http.Request, project model.Project) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "方法不允许")
		return
	}
	token, err := security.RandomToken(24)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成分享令牌失败")
		return
	}
	project.ShareState = model.ShareToken
	project.ShareTokenHash = security.TokenHash(token)
	updated, err := a.store.UpdateProjectSettings(project)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存分享令牌失败")
		return
	}
	dto := a.projectDTO(updated, r)
	dto.ShareURL = dto.AccessURL + "?token=" + token
	writeJSON(w, http.StatusOK, map[string]any{"project": dto, "token": token, "shareUrl": dto.ShareURL})
}

// handleVersions 处理版本列表和回滚。
func (a *App) handleVersions(w http.ResponseWriter, r *http.Request, project model.Project, parts []string) {
	if len(parts) == 0 && r.Method == http.MethodGet {
		versions, err := a.store.ListVersions(project.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "查询版本失败")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"versions": versions})
		return
	}
	if len(parts) == 2 && parts[1] == "activate" && r.Method == http.MethodPost {
		versionID, ok := parseID(parts[0])
		if !ok {
			writeError(w, http.StatusBadRequest, "版本 ID 无效")
			return
		}
		version, err := a.store.VersionByID(versionID)
		if err != nil || version.ProjectID != project.ID {
			if err == nil {
				err = sql.ErrNoRows
			}
			notFoundOrError(w, err, "查询版本失败")
			return
		}
		updated, err := a.store.ActivateVersion(project, version)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "回滚版本失败")
			return
		}
		if err := a.syncProjectRuntime(updated); err != nil {
			writeError(w, http.StatusBadRequest, "应用项目运行状态失败: "+err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"project": a.projectDTO(updated, r)})
		return
	}
	writeError(w, http.StatusNotFound, "接口不存在")
}
