// 文件功能描述：实现管理后台单页应用，提供三栏工作台、项目标签页、用户管理和分享地址视图。
import { api } from "./api";
import type { AccessMode, FileEntry, Project, ProjectVersion, PublicHostInfo, ShareState, User } from "./types";
import "./styles.css";

type ActiveView = "projects" | "users" | "share";
type ProjectTab = "overview" | "publish" | "files" | "versions" | "settings";
type ShareFilter = "all" | ShareState;
type UserModalMode = "create" | "edit" | "reset";

interface UserModal {
  mode: UserModalMode;
  userId?: number;
}

interface State {
  me: User | null;
  users: User[];
  projects: Project[];
  selectedId: number | null;
  versions: ProjectVersion[];
  files: FileEntry[];
  publicHostInfo: PublicHostInfo | null;
  filePath: string;
  activeView: ActiveView;
  activeProjectTab: ProjectTab;
  projectSearch: string;
  projectShareFilter: ShareFilter;
  createModalOpen: boolean;
  userSearch: string;
  userModal: UserModal | null;
  message: string;
  error: string;
  shareUrl: string;
}

const state: State = {
  me: null,
  users: [],
  projects: [],
  selectedId: null,
  versions: [],
  files: [],
  publicHostInfo: null,
  filePath: "",
  activeView: "projects",
  activeProjectTab: "overview",
  projectSearch: "",
  projectShareFilter: "all",
  createModalOpen: false,
  userSearch: "",
  userModal: null,
  message: "",
  error: "",
  shareUrl: "",
};

const app = document.querySelector<HTMLDivElement>("#app")!;

// init 初始化登录状态并渲染页面。
async function init() {
  try {
    const { user } = await api.me();
    state.me = user;
    await refreshAll();
  } catch {
    state.me = null;
  }
  render();
}

// refreshAll 拉取项目、用户和当前项目详情数据。
async function refreshAll() {
  if (!state.me) return;
  const isAdmin = state.me.role === "admin";
  if ((state.activeView === "users" || state.activeView === "share") && !isAdmin) state.activeView = "projects";
  const [{ projects }] = await Promise.all([api.projects(), isAdmin ? refreshAdminData() : Promise.resolve()]);
  state.projects = projects ?? [];
  if (!state.selectedId || !state.projects.some((project) => project.id === state.selectedId)) {
    state.selectedId = state.projects[0]?.id ?? null;
  }
  await refreshSelected();
}

// loadUsers 在管理员视图中刷新用户列表。
async function loadUsers() {
  const { users } = await api.users();
  state.users = users ?? [];
}

// refreshAdminData 刷新管理员专属的用户和系统配置数据。
async function refreshAdminData() {
  await Promise.all([loadUsers(), loadPublicHostInfo()]);
}

// loadPublicHostInfo 刷新本机地址候选和当前公开分享主机。
async function loadPublicHostInfo() {
  state.publicHostInfo = await api.publicHost();
}

// refreshSelected 刷新当前项目的版本和文件列表。
async function refreshSelected() {
  const selected = selectedProject();
  if (!selected || !selected.currentVersionId) {
    state.versions = [];
    state.files = [];
    return;
  }
  const [{ versions }, { files }] = await Promise.all([api.versions(selected.id), api.files(selected.id, state.filePath)]);
  state.versions = versions ?? [];
  state.files = files ?? [];
}

// selectedProject 返回当前选中的项目。
function selectedProject() {
  return state.projects.find((project) => project.id === state.selectedId) || null;
}

// filteredProjects 返回应用本地搜索和分享状态筛选后的项目列表。
function filteredProjects() {
  const keyword = state.projectSearch.trim().toLowerCase();
  return state.projects.filter((project) => {
    const matchesKeyword = !keyword || project.name.toLowerCase().includes(keyword) || project.slug.toLowerCase().includes(keyword);
    const matchesShare = state.projectShareFilter === "all" || project.shareState === state.projectShareFilter;
    return matchesKeyword && matchesShare;
  });
}

// filteredUsers 返回匹配用户名、邮箱和角色的用户列表。
function filteredUsers() {
  const keyword = state.userSearch.trim().toLowerCase();
  if (!keyword) return state.users;
  return state.users.filter((user) => {
    return (
      user.username.toLowerCase().includes(keyword) ||
      (user.email || "").toLowerCase().includes(keyword) ||
      roleLabel(user.role).toLowerCase().includes(keyword)
    );
  });
}

// render 根据登录状态渲染登录页或管理工作台。
function render() {
  app.innerHTML = state.me ? dashboardTemplate() : loginTemplate();
  bindEvents();
}

// loginTemplate 渲染登录表单。
function loginTemplate() {
  return `
    <main class="login-shell">
      <form class="login-panel" data-form="login">
        <div class="login-brand">
          <span class="logo">SH</span>
          <div>
            <h1>静态项目托管</h1>
            <p>内部管理控制台</p>
          </div>
        </div>
        ${noticeTemplate()}
        <label>用户名 / 邮箱<input name="username" autocomplete="username" required /></label>
        <label>密码<input name="password" type="password" autocomplete="current-password" required /></label>
        <button class="primary block" type="submit">登录</button>
      </form>
    </main>
  `;
}

// dashboardTemplate 渲染三栏工作台。
function dashboardTemplate() {
  const projectMode = state.activeView === "projects";
  return `
    <main class="console-shell ${projectMode ? "" : "single-workspace"}">
      ${globalNavTemplate()}
      ${projectMode ? projectColumnTemplate() : ""}
      <section class="workspace">
        ${activeWorkspaceTemplate()}
      </section>
      ${state.createModalOpen && projectMode ? createProjectModalTemplate() : ""}
      ${state.userModal && state.activeView === "users" ? userModalTemplate() : ""}
    </main>
  `;
}

// activeWorkspaceTemplate 根据全局视图渲染右侧工作区。
function activeWorkspaceTemplate() {
  if (state.activeView === "users") return usersViewTemplate();
  if (state.activeView === "share") return shareAddressViewTemplate();
  return projectWorkspaceTemplate();
}

// globalNavTemplate 渲染左侧全局导航和账号区。
function globalNavTemplate() {
  const user = state.me!;
  return `
    <aside class="global-nav">
      <div class="brand">
        <span class="logo">SH</span>
        <div>
          <strong>Static Host</strong>
          <span>静态项目托管</span>
        </div>
      </div>
      <nav class="nav-stack">
        <button class="nav-item ${state.activeView === "projects" ? "active" : ""}" data-action="set-view" data-view="projects">
          <span>项目</span><b>${state.projects.length}</b>
        </button>
        ${
          user.role === "admin"
            ? `<button class="nav-item ${state.activeView === "share" ? "active" : ""}" data-action="set-view" data-view="share">
                <span>分享地址</span><b>IP</b>
              </button>
              <button class="nav-item ${state.activeView === "users" ? "active" : ""}" data-action="set-view" data-view="users">
                <span>用户</span><b>${state.users.length}</b>
              </button>`
            : ""
        }
      </nav>
      <div class="account-box">
        <div>
          <strong>${escapeHTML(user.username)}</strong>
          <span>${roleLabel(user.role)}</span>
        </div>
        <button data-action="logout">退出</button>
      </div>
    </aside>
  `;
}

// projectColumnTemplate 渲染中栏项目列表、搜索、筛选和创建表单。
function projectColumnTemplate() {
  const items = filteredProjects();
  return `
    <aside class="project-column">
      <div class="column-head">
        <div>
          <h2>项目</h2>
          <span class="muted project-count">${items.length} / ${state.projects.length}</span>
        </div>
        <button class="primary" data-action="open-create-modal">新建</button>
      </div>
      <div class="project-filters">
        <input data-input="project-search" value="${escapeAttr(state.projectSearch)}" placeholder="搜索项目名称或标识" />
        <select data-change="share-filter">
          ${option("all", "全部状态", state.projectShareFilter)}
          ${option("public", "公开", state.projectShareFilter)}
          ${option("share", "令牌分享", state.projectShareFilter)}
          ${option("unshared", "不分享", state.projectShareFilter)}
        </select>
      </div>
      <div class="project-list">${items.map(projectItemTemplate).join("") || `<p class="empty">没有匹配项目</p>`}</div>
    </aside>
  `;
}

// createProjectModalTemplate 渲染创建项目弹窗，支持创建时直接选择发布文件。
function createProjectModalTemplate() {
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="创建项目">
        <div class="modal-head">
          <div>
            <span class="eyebrow">新建项目</span>
            <h2>创建并发布</h2>
          </div>
          <button class="ghost" type="button" data-action="close-create-modal">关闭</button>
        </div>
        <form class="modal-form" data-form="project">
          <label>项目名称<input name="name" placeholder="例如：后台管理系统" required autofocus /></label>
          <label>发布文件（可选）<input name="file" type="file" accept=".zip,.html,.htm,application/zip,text/html" /></label>
          <div class="hint">项目标识会按日期和随机码自动生成；选择 ZIP 会按构建产物发布，选择 HTML 会作为 index.html 发布。</div>
          <div class="modal-actions">
            <button type="button" data-action="close-create-modal">取消</button>
            <button class="primary" type="submit">创建项目</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

// projectItemTemplate 渲染项目列表项。
function projectItemTemplate(project: Project) {
  const active = project.id === state.selectedId ? "active" : "";
  return `
    <button class="project-item ${active}" data-action="select-project" data-id="${project.id}">
      <span class="project-name">${escapeHTML(project.name)}</span>
      <span class="project-meta">
        <b>${escapeHTML(project.slug)}</b>
        <em>${accessModeLabel(project.accessMode)}</em>
      </span>
      <span class="mini-pills">
        <i class="${project.active ? "enabled" : "disabled"}">${activeStateLabel(project.active)}</i>
        <i class="${project.shareState}">${shareStateLabel(project.shareState)}</i>
        <i>${project.currentVersionId ? "已发布" : "未发布"}</i>
      </span>
    </button>
  `;
}

// projectWorkspaceTemplate 渲染右侧项目工作区。
function projectWorkspaceTemplate() {
  const project = selectedProject();
  if (!project) return emptyProjectTemplate();
  return `
    <div class="workspace-stack">
      ${noticeTemplate()}
      ${projectHeroTemplate(project)}
      ${projectTabsTemplate(project)}
      ${projectTabContentTemplate(project)}
    </div>
  `;
}

// projectHeroTemplate 渲染项目顶部概览和快捷操作。
function projectHeroTemplate(project: Project) {
  return `
    <section class="hero-panel">
      <div class="hero-main">
        <div class="status-row">
          <span class="pill ${project.active ? "enabled" : "disabled"}">${activeStateLabel(project.active)}</span>
          <span class="pill">${accessModeLabel(project.accessMode)}</span>
          <span class="pill ${project.shareState}">${shareStateLabel(project.shareState)}</span>
          <span class="pill">${project.spaEnabled ? "SPA fallback" : "普通静态"}</span>
        </div>
        <h1>${escapeHTML(project.name)}</h1>
        <div class="slug-line">${escapeHTML(project.slug)}</div>
      </div>
      <div class="hero-actions">
        <button class="primary" data-action="copy-link" data-url="${escapeAttr(project.accessUrl)}" ${project.active ? "" : "disabled"}>复制地址</button>
        ${project.active ? `<a class="button-link" href="${escapeAttr(project.accessUrl)}" target="_blank" rel="noreferrer">打开项目</a>` : `<button disabled>打开项目</button>`}
        ${project.currentVersionId ? `<a class="button-link" href="${escapeAttr(api.packageExeUrl(project.id))}">下载 EXE</a>` : `<button disabled>下载 EXE</button>`}
        <button data-action="set-tab" data-tab="publish">发布</button>
        <button data-action="share-token">分享链接</button>
        ${
          project.active
            ? `<button class="danger" data-action="deactivate-project">停用</button>`
            : `<button class="primary" data-action="activate-project">激活</button>`
        }
      </div>
      <div class="access-strip">
        <span>访问地址</span>
        ${project.active ? `<a href="${escapeAttr(project.accessUrl)}" target="_blank" rel="noreferrer">${escapeHTML(project.accessUrl)}</a>` : `<code>${escapeHTML(project.accessUrl)}</code>`}
      </div>
      ${state.shareUrl ? `<div class="access-strip token"><span>分享链接</span><code>${escapeHTML(state.shareUrl)}</code></div>` : ""}
      <div class="summary-grid">
        ${summaryItem("BaseURL", project.detectedBaseUrl || "未识别")}
        ${summaryItem("入口文件", project.entryFile || "index.html")}
        ${summaryItem("挂载路径", project.mountPath || "-")}
        ${summaryItem("端口", project.port ? String(project.port) : "-")}
        ${summaryItem("运行状态", activeStateLabel(project.active))}
      </div>
    </section>
  `;
}

// projectTabsTemplate 渲染项目详情标签页。
function projectTabsTemplate(project: Project) {
  const tabs: Array<[ProjectTab, string]> = [
    ["overview", "概览"],
    ["publish", "发布"],
    ["files", "文件"],
    ["versions", `版本 ${state.versions.length}`],
    ["settings", "设置"],
  ];
  return `
    <div class="tabs">
      ${tabs.map(([key, label]) => `<button class="${state.activeProjectTab === key ? "active" : ""}" data-action="set-tab" data-tab="${key}">${label}</button>`).join("")}
      <button class="ghost danger" data-action="delete-project" data-id="${project.id}">删除项目</button>
    </div>
  `;
}

// projectTabContentTemplate 根据当前标签渲染内容。
function projectTabContentTemplate(project: Project) {
  switch (state.activeProjectTab) {
    case "publish":
      return publishTabTemplate(project);
    case "files":
      return filesTabTemplate(project);
    case "versions":
      return versionsTabTemplate(project);
    case "settings":
      return settingsTabTemplate(project);
    default:
      return overviewTabTemplate(project);
  }
}

// overviewTabTemplate 渲染项目概览、风险提示和推荐操作。
function overviewTabTemplate(project: Project) {
  return `
    <section class="content-grid">
      <div class="panel">
        <div class="panel-head">
          <h3>运行状态</h3>
          <span>${project.active ? (project.currentVersionId ? "已发布" : "等待发布") : "已停用"}</span>
        </div>
        ${warningsTemplate(project.warnings)}
        ${
          !project.active
            ? `<div class="status-card">
                <strong>项目已停用</strong>
                <span>访问模式为 ${accessModeLabel(project.accessMode)}，分享状态为 ${shareStateLabel(project.shareState)}。</span>
              </div>`
            : project.currentVersionId
            ? `<div class="status-card success">
                <strong>当前项目可访问</strong>
                <span>访问模式为 ${accessModeLabel(project.accessMode)}，分享状态为 ${shareStateLabel(project.shareState)}。</span>
              </div>`
            : `<div class="status-card">
                <strong>还没有发布版本</strong>
                <span>上传 ZIP 构建产物或单 HTML 文件后，系统会识别 BaseURL 并生成访问地址。</span>
                <button class="primary" data-action="set-tab" data-tab="publish">去发布</button>
              </div>`
        }
      </div>
      <div class="panel">
        <div class="panel-head">
          <h3>快捷操作</h3>
          <span>常用流程</span>
        </div>
        <div class="quick-grid">
          <button data-action="set-tab" data-tab="publish">上传新版本</button>
          <button data-action="set-tab" data-tab="files" ${project.currentVersionId ? "" : "disabled"}>管理文件</button>
          <button data-action="set-tab" data-tab="versions" ${state.versions.length ? "" : "disabled"}>查看版本</button>
          ${project.currentVersionId ? `<a class="button-link" href="${escapeAttr(api.packageExeUrl(project.id))}">下载 EXE</a>` : `<button disabled>下载 EXE</button>`}
          <button data-action="set-tab" data-tab="settings">调整设置</button>
        </div>
      </div>
    </section>
  `;
}

// publishTabTemplate 渲染 ZIP 和 HTML 发布表单。
function publishTabTemplate(project: Project) {
  return `
    <section class="panel">
      <div class="panel-head">
        <h3>发布项目</h3>
        <span>当前版本 ${project.currentVersionId || "-"}</span>
      </div>
      <div class="publish-grid">
        <div class="upload-box">
          <strong>ZIP 构建产物</strong>
          <span>适合 Vite、Vue、React、Webpack 构建后的 dist 目录压缩包。</span>
          <label>选择 ZIP<input name="zip" type="file" accept=".zip" data-file="zip" /></label>
          <button class="primary" data-action="publish-zip" data-id="${project.id}">上传 ZIP</button>
        </div>
        <div class="upload-box">
          <strong>单 HTML 文件</strong>
          <span>上传后会保存为 index.html，并直接生成访问地址。</span>
          <label>选择 HTML<input name="html" type="file" accept=".html,.htm,text/html" data-file="html" /></label>
          <button data-action="publish-html" data-id="${project.id}">上传 HTML</button>
        </div>
      </div>
    </section>
  `;
}

// filesTabTemplate 渲染项目文件管理页。
function filesTabTemplate(project: Project) {
  const parent = state.filePath.split("/").filter(Boolean).slice(0, -1).join("/");
  if (!project.currentVersionId) {
    return `<section class="panel">${emptyInlineTemplate("当前项目还没有版本，发布后才能管理文件。")}</section>`;
  }
  return `
    <section class="panel">
      <div class="panel-head">
        <h3>文件管理</h3>
        <span>${state.files.length} 项</span>
      </div>
      <div class="pathbar">
        <button data-action="open-path" data-path="">根目录</button>
        ${state.filePath ? `<button data-action="open-path" data-path="${escapeAttr(parent)}">上级</button>` : ""}
        <code>/${escapeHTML(state.filePath)}</code>
      </div>
      <form class="file-upload" data-form="file">
        <input name="path" placeholder="保存路径，例如 assets/logo.png" required />
        <input name="file" type="file" required />
        <button class="primary" type="submit">上传/替换</button>
      </form>
      <div class="table-list file-table">
        ${state.files.map(fileRowTemplate).join("") || `<p class="empty">空目录</p>`}
      </div>
    </section>
  `;
}

// fileRowTemplate 渲染单个文件或目录行。
function fileRowTemplate(file: FileEntry) {
  return `
    <div class="table-row">
      <button class="file-cell" data-action="${file.isDir ? "open-path" : "noop"}" data-path="${escapeAttr(file.path)}">
        <span class="file-badge">${file.isDir ? "DIR" : "FILE"}</span>
        <span>${escapeHTML(file.name)}</span>
      </button>
      <span>${file.isDir ? "目录" : formatSize(file.size)}</span>
      <button class="ghost danger" data-action="delete-file" data-path="${escapeAttr(file.path)}">删除</button>
    </div>
  `;
}

// versionsTabTemplate 渲染历史版本和回滚操作。
function versionsTabTemplate(project: Project) {
  return `
    <section class="panel">
      <div class="panel-head">
        <h3>版本历史</h3>
        <span>${state.versions.length} 条</span>
      </div>
      <div class="table-list">
        ${state.versions
          .map(
            (version) => `
              <div class="table-row">
                <div>
                  <strong>#${version.versionNumber}</strong>
                  <span>${escapeHTML(version.sourceType)} · ${formatSize(version.sizeBytes)} · ${formatDate(version.createdAt)}</span>
                </div>
                <span>${escapeHTML(version.detectedBaseUrl || "未识别")}</span>
                <button data-action="activate-version" data-version="${version.id}" ${version.id === project.currentVersionId ? "disabled" : ""}>激活</button>
              </div>`,
          )
          .join("") || `<p class="empty">暂无版本</p>`}
      </div>
    </section>
  `;
}

// settingsTabTemplate 渲染项目低频配置表单。
function settingsTabTemplate(project: Project) {
  return `
    <form class="panel" data-form="settings">
      <div class="panel-head">
        <h3>项目设置</h3>
        <span>低频配置</span>
      </div>
      <div class="field-grid">
        <label>名称<input name="name" value="${escapeAttr(project.name)}" /></label>
        <label>项目标识<input name="slug" value="${escapeAttr(project.slug)}" /></label>
        <label>入口文件<input name="entryFile" value="${escapeAttr(project.entryFile)}" /></label>
        <label>挂载路径<input name="mountPath" value="${escapeAttr(project.mountPath)}" placeholder="/demo/" /></label>
        <label>访问模式
          <select name="accessMode">
            ${option("path", "路径", project.accessMode)}
            ${option("mount", "挂载路径", project.accessMode)}
            ${option("port", "独立端口", project.accessMode)}
          </select>
        </label>
        <label>分享状态
          <select name="shareState">
            ${option("public", "公开", project.shareState)}
            ${option("share", "分享令牌", project.shareState)}
            ${option("unshared", "不分享", project.shareState)}
          </select>
        </label>
      </div>
      <label class="check"><input name="spaEnabled" type="checkbox" ${project.spaEnabled ? "checked" : ""} /> SPA fallback</label>
      <div class="form-actions">
        <button class="primary" type="submit">保存设置</button>
      </div>
    </form>
  `;
}

// usersViewTemplate 渲染管理员用户管理视图。
function usersViewTemplate() {
  if (state.me?.role !== "admin") return `<section class="panel">${emptyInlineTemplate("需要管理员权限。")}</section>`;
  const users = filteredUsers();
  return `
    <div class="workspace-stack">
      ${noticeTemplate()}
      <section class="view-head">
        <div>
          <span class="eyebrow">用户管理</span>
          <h1>账号与权限</h1>
        </div>
        <button class="primary" data-action="open-user-modal" data-mode="create">创建用户</button>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>用户列表</h3>
          <span>${users.length} / ${state.users.length} 个账号</span>
        </div>
        <div class="user-toolbar">
          <input data-input="user-search" value="${escapeAttr(state.userSearch)}" placeholder="搜索用户名、邮箱或角色" />
        </div>
        ${users.length ? userTableTemplate(users) : `<p class="empty">没有匹配用户</p>`}
      </section>
    </div>
  `;
}

// userTableTemplate 渲染用户表格列表。
function userTableTemplate(users: User[]) {
  return `
    <div class="user-table-wrap">
      <table class="user-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((user, index) => userRowTemplate(user, index)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// userRowTemplate 渲染单个用户表格行。
function userRowTemplate(user: User, index: number) {
  const isCurrent = user.id === state.me?.id;
  const nextDisabled = !user.disabled;
  return `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHTML(user.username)}</strong></td>
      <td>${user.email ? escapeHTML(user.email) : `<span class="muted">未设置</span>`}</td>
      <td>${roleLabel(user.role)}</td>
      <td><span class="state-badge ${user.disabled ? "disabled" : "enabled"}">${user.disabled ? "已禁用" : "启用中"}</span></td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <div class="user-actions">
          <button data-action="open-user-modal" data-mode="edit" data-id="${user.id}">编辑</button>
          <button data-action="open-user-modal" data-mode="reset" data-id="${user.id}">重置密码</button>
          <button data-action="toggle-user" data-id="${user.id}" data-disabled="${nextDisabled}" ${isCurrent && nextDisabled ? "disabled" : ""}>
            ${user.disabled ? "启用" : "禁用"}
          </button>
        </div>
      </td>
    </tr>
  `;
}

// userModalTemplate 渲染创建、编辑和密码重置弹窗。
function userModalTemplate() {
  const modal = state.userModal!;
  const user = modal.userId ? state.users.find((item) => item.id === modal.userId) : null;
  if (modal.mode !== "create" && !user) return "";
  if (modal.mode === "reset" && user) {
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal-panel" role="dialog" aria-modal="true" aria-label="重置密码">
          <div class="modal-head">
            <div>
              <span class="eyebrow">重置密码</span>
              <h2>${escapeHTML(user.username)}</h2>
            </div>
            <button class="ghost" type="button" data-action="close-user-modal">关闭</button>
          </div>
          <form class="modal-form" data-form="user-reset" data-user-id="${user.id}">
            <label>新密码<input name="password" type="password" autocomplete="new-password" minlength="8" required autofocus /></label>
            <div class="modal-actions">
              <button type="button" data-action="close-user-modal">取消</button>
              <button class="primary" type="submit">保存密码</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }
  const editing = modal.mode === "edit" && !!user;
  const formUser = user || null;
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="${editing ? "编辑用户" : "创建用户"}">
        <div class="modal-head">
          <div>
            <span class="eyebrow">${editing ? "编辑用户" : "创建用户"}</span>
            <h2>${editing && formUser ? escapeHTML(formUser.username) : "新增账号"}</h2>
          </div>
          <button class="ghost" type="button" data-action="close-user-modal">关闭</button>
        </div>
        <form class="modal-form" data-form="${editing ? "user-edit" : "user-create"}" ${editing && formUser ? `data-user-id="${formUser.id}"` : ""}>
          <label>用户名<input name="username" value="${escapeAttr(formUser?.username || "")}" minlength="3" required autofocus /></label>
          <label>邮箱<input name="email" type="email" value="${escapeAttr(formUser?.email || "")}" placeholder="name@example.com" ${editing ? "" : "required"} /></label>
          ${
            editing
              ? ""
              : `<label>初始密码<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>`
          }
          <label>角色
            <select name="role">
              ${option("user", "用户", formUser?.role || "user")}
              ${option("admin", "管理员", formUser?.role || "user")}
            </select>
          </label>
          ${
            editing
              ? `<label class="check"><input name="disabled" type="checkbox" ${formUser?.disabled ? "checked" : ""} ${formUser?.id === state.me?.id ? "disabled" : ""} /> 禁用账号</label>`
              : ""
          }
          <div class="modal-actions">
            <button type="button" data-action="close-user-modal">取消</button>
            <button class="primary" type="submit">${editing ? "保存用户" : "创建用户"}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

// shareAddressViewTemplate 渲染管理员专用的分享地址管理页。
function shareAddressViewTemplate() {
  if (state.me?.role !== "admin") return `<section class="panel">${emptyInlineTemplate("需要管理员权限。")}</section>`;
  const current = state.publicHostInfo?.publicHost || "未设置";
  return `
    <div class="workspace-stack">
      ${noticeTemplate()}
      <section class="view-head">
        <div>
          <span class="eyebrow">分享地址</span>
          <h1>访问主机管理</h1>
        </div>
        <span>只有管理员可以修改项目访问地址使用的主机。</span>
      </section>
      <section class="panel">
        ${systemAddressTemplate()}
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>地址生成规则</h3>
          <span>当前主机：${escapeHTML(current)}</span>
        </div>
        <div class="info-list">
          <div><strong>管理后台</strong><span>继续使用 8080 端口，不受分享地址设置影响。</span></div>
          <div><strong>路径分享</strong><span>项目地址会按当前主机和 8081 分享端口生成。</span></div>
          <div><strong>独立端口</strong><span>端口模式项目会按当前主机和项目端口生成根路径访问地址。</span></div>
        </div>
      </section>
    </div>
  `;
}

// systemAddressTemplate 渲染管理员可选择的分享地址主机。
function systemAddressTemplate() {
  const info = state.publicHostInfo;
  const candidates = info?.candidates ?? [];
  const current = info?.publicHost ?? "";
  const displayHost = current || "未设置";
  const gatewayURL = current ? `${window.location.protocol}//${urlHost(current)}:8081/` : "未设置";
  return `
    <div class="address-layout">
      <div class="address-current">
        <span class="eyebrow">当前地址</span>
        <h3>分享网关地址</h3>
        <code class="current-address">${escapeHTML(gatewayURL)}</code>
        <div class="address-meta">
          <div><strong>当前主机</strong><span>${escapeHTML(displayHost)}</span></div>
          <div><strong>项目链接</strong><span>路径分享使用 8081；独立端口项目使用项目自己的端口。</span></div>
        </div>
      </div>
      <form class="address-form" data-form="public-host">
        <div class="address-form-head">
          <h3>修改地址</h3>
          <span>选择检测到的本机地址，或输入自定义 IP / 主机名。</span>
        </div>
        <label>本机地址
          <select name="publicHost">
            ${candidates.map((item) => option(item, item, current)).join("")}
          </select>
        </label>
        <label>自定义地址
          <input name="customHost" placeholder="例如 192.168.1.20 或 host.local" />
        </label>
        <div class="form-actions">
          <button class="primary" type="submit">保存地址</button>
        </div>
        <div class="hint">保存后会刷新项目列表和项目访问地址。</div>
      </form>
    </div>
  `;
}

// emptyProjectTemplate 渲染没有项目时的空状态。
function emptyProjectTemplate() {
  return `
    <section class="empty-state">
      <h2>还没有项目</h2>
      <p>在中栏创建项目后，上传 ZIP 或 HTML 即可获得访问地址。</p>
    </section>
  `;
}

// emptyInlineTemplate 渲染面板内部空状态。
function emptyInlineTemplate(message: string) {
  return `<div class="inline-empty">${escapeHTML(message)}</div>`;
}

// warningsTemplate 渲染路径风险提示，没有风险时不占位。
function warningsTemplate(warnings: string[] | null | undefined) {
  const items = warnings ?? [];
  if (!items.length) return "";
  return `<ul class="warnings">${items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`;
}

// noticeTemplate 渲染成功或错误消息。
function noticeTemplate() {
  return `${state.error ? `<div class="notice error">${escapeHTML(state.error)}</div>` : ""}${state.message ? `<div class="notice">${escapeHTML(state.message)}</div>` : ""}`;
}

// bindEvents 绑定当前渲染树上的表单、按钮和筛选控件事件。
function bindEvents() {
  app.querySelectorAll("form").forEach((form) => form.addEventListener("submit", onSubmit));
  app.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => el.addEventListener("click", onAction));
  app.querySelector<HTMLInputElement>('[data-input="project-search"]')?.addEventListener("input", onProjectSearch);
  app.querySelector<HTMLInputElement>('[data-input="user-search"]')?.addEventListener("input", onUserSearch);
  app.querySelector<HTMLSelectElement>('[data-change="share-filter"]')?.addEventListener("change", onShareFilter);
}

// onProjectSearch 更新项目搜索条件并重新渲染。
function onProjectSearch(event: Event) {
  state.projectSearch = (event.currentTarget as HTMLInputElement).value;
  render();
}

// onUserSearch 更新用户搜索条件并重新渲染。
function onUserSearch(event: Event) {
  state.userSearch = (event.currentTarget as HTMLInputElement).value;
  render();
}

// onShareFilter 更新分享状态筛选条件并重新渲染。
function onShareFilter(event: Event) {
  state.projectShareFilter = (event.currentTarget as HTMLSelectElement).value as ShareFilter;
  render();
}

// onSubmit 处理所有表单提交。
async function onSubmit(event: Event) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  await run(async () => {
    switch (form.dataset.form) {
      case "login": {
        const { user } = await api.login(String(data.get("username")), String(data.get("password")));
        state.me = user;
        state.activeView = "projects";
        await refreshAll();
        break;
      }
      case "project": {
        const file = data.get("file");
        const uploadFile = file instanceof File && file.size > 0 ? file : null;
        const kind = uploadFile ? detectPublishKind(uploadFile) : null;
        const { project } = await api.createProject({ name: String(data.get("name")) });
        state.selectedId = project.id;
        state.activeProjectTab = "overview";
        state.createModalOpen = false;
        await refreshAll();
        if (uploadFile && kind === "zip") await api.publishZip(project.id, uploadFile);
        if (uploadFile && kind === "html") await api.publishHtml(project.id, uploadFile);
        await refreshAll();
        break;
      }
      case "settings":
        await saveSettings(form);
        break;
      case "file":
        await uploadManagedFile(form);
        break;
      case "user-create":
        await api.createUser({
          username: String(data.get("username")),
          email: String(data.get("email")),
          password: String(data.get("password")),
          role: String(data.get("role")),
        });
        state.userModal = null;
        await loadUsers();
        break;
      case "user-edit":
        await saveUser(form);
        break;
      case "user-reset":
        await resetUserPassword(form);
        break;
      case "public-host": {
        const custom = String(data.get("customHost") || "").trim();
        const selected = String(data.get("publicHost") || "").trim();
        await api.updatePublicHost(custom || selected);
        await refreshAll();
        break;
      }
    }
  });
}

// onAction 处理按钮动作。
async function onAction(event: Event) {
  const target = event.currentTarget as HTMLElement;
  const action = target.dataset.action;
  if (action === "noop") return;
  if (action === "set-view") {
    const nextView = (target.dataset.view || "projects") as ActiveView;
    state.activeView = state.me?.role === "admin" || nextView === "projects" ? nextView : "projects";
    state.createModalOpen = false;
    state.userModal = null;
    state.error = "";
    state.message = "";
    try {
      if (state.activeView === "users") await loadUsers();
      if (state.activeView === "share") await loadPublicHostInfo();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "加载视图失败";
    }
    render();
    return;
  }
  if (action === "set-tab") {
    state.activeProjectTab = (target.dataset.tab || "overview") as ProjectTab;
    state.error = "";
    state.message = "";
    render();
    return;
  }
  if (action === "select-project") {
    state.selectedId = Number(target.dataset.id);
    state.filePath = "";
    state.shareUrl = "";
    state.activeProjectTab = "overview";
    state.error = "";
    state.message = "";
    await refreshSelected();
    render();
    return;
  }
  if (action === "open-path") {
    state.filePath = target.dataset.path || "";
    state.error = "";
    state.message = "";
    await refreshSelected();
    render();
    return;
  }
  if (action === "open-create-modal") {
    state.createModalOpen = true;
    state.error = "";
    state.message = "";
    render();
    return;
  }
  if (action === "close-create-modal") {
    state.createModalOpen = false;
    state.error = "";
    state.message = "";
    render();
    return;
  }
  if (action === "open-user-modal") {
    state.userModal = { mode: (target.dataset.mode || "create") as UserModalMode, userId: Number(target.dataset.id) || undefined };
    state.error = "";
    state.message = "";
    render();
    return;
  }
  if (action === "close-user-modal") {
    state.userModal = null;
    state.error = "";
    state.message = "";
    render();
    return;
  }
  await run(async () => {
    const project = selectedProject();
    switch (action) {
      case "logout":
        await api.logout();
        state.me = null;
        state.activeView = "projects";
        state.selectedId = null;
        break;
      case "copy-link":
        await copyText(target.dataset.url || "");
        state.message = "访问地址已复制";
        break;
      case "publish-zip":
        await publishSelected("zip");
        break;
      case "publish-html":
        await publishSelected("html");
        break;
      case "share-token":
        if (project) {
          const result = await api.shareToken(project.id);
          state.shareUrl = result.shareUrl;
          await refreshAll();
        }
        break;
      case "activate-project":
        if (project) {
          await api.activateProject(project.id);
          await refreshAll();
        }
        break;
      case "deactivate-project":
        if (project && confirm("确认停用该项目？")) {
          await api.deactivateProject(project.id);
          await refreshAll();
        }
        break;
      case "activate-version":
        if (project) await api.activateVersion(project.id, Number(target.dataset.version));
        state.activeProjectTab = "overview";
        await refreshAll();
        break;
      case "delete-file":
        if (project && confirm("确认删除该路径？")) {
          await api.deleteFile(project.id, target.dataset.path || "");
          await refreshAll();
        }
        break;
      case "delete-project":
        if (project && confirm("确认删除该项目？")) {
          await api.deleteProject(project.id);
          state.selectedId = null;
          await refreshAll();
        }
        break;
      case "toggle-user":
        await toggleUser(Number(target.dataset.id), target.dataset.disabled === "true");
        break;
    }
  });
}

// detectPublishKind 根据文件扩展名判断创建时发布类型。
function detectPublishKind(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) return "zip";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
  throw new Error("创建时只支持上传 ZIP、HTML 或 HTM 文件");
}

// saveSettings 保存项目基础设置。
async function saveSettings(form: HTMLFormElement) {
  const project = selectedProject();
  if (!project) return;
  const data = new FormData(form);
  await api.updateProject(project.id, {
    name: String(data.get("name")),
    slug: String(data.get("slug")),
    entryFile: String(data.get("entryFile")),
    mountPath: String(data.get("mountPath")),
    accessMode: String(data.get("accessMode")),
    shareState: String(data.get("shareState")),
    spaEnabled: Boolean(data.get("spaEnabled")),
  });
  state.activeProjectTab = "overview";
  await refreshAll();
}

// publishSelected 上传当前项目的 ZIP 或 HTML。
async function publishSelected(kind: "zip" | "html") {
  const project = selectedProject();
  if (!project) return;
  const input = app.querySelector<HTMLInputElement>(`input[data-file="${kind}"]`);
  const file = input?.files?.[0];
  if (!file) throw new Error("请选择文件");
  if (kind === "zip") await api.publishZip(project.id, file);
  else await api.publishHtml(project.id, file);
  state.activeProjectTab = "overview";
  await refreshAll();
}

// uploadManagedFile 上传或替换当前项目中的单个文件。
async function uploadManagedFile(form: HTMLFormElement) {
  const project = selectedProject();
  if (!project) return;
  const data = new FormData(form);
  const file = data.get("file");
  if (!(file instanceof File)) throw new Error("请选择文件");
  await api.putFile(project.id, String(data.get("path")), file);
  await refreshAll();
  state.activeProjectTab = "files";
}

// saveUser 保存用户名称、邮箱、角色和禁用状态。
async function saveUser(form: HTMLFormElement) {
  const id = Number(form.dataset.userId);
  const current = state.users.find((user) => user.id === id);
  if (!current) throw new Error("用户不存在");
  const data = new FormData(form);
  const disabled = current.id === state.me?.id ? false : Boolean(data.get("disabled"));
  const { user } = await api.updateUser(id, {
    username: String(data.get("username")),
    email: String(data.get("email")),
    role: String(data.get("role")),
    disabled,
  });
  if (state.me?.id === user.id) state.me = user;
  state.userModal = null;
  await loadUsers();
}

// resetUserPassword 重置指定用户密码。
async function resetUserPassword(form: HTMLFormElement) {
  const id = Number(form.dataset.userId);
  const password = String(new FormData(form).get("password"));
  await api.resetPassword(id, password);
  state.userModal = null;
  await loadUsers();
}

// toggleUser 启用或禁用用户，禁用当前用户由后端再次保护。
async function toggleUser(id: number, disabled: boolean) {
  const user = state.users.find((item) => item.id === id);
  if (!user) throw new Error("用户不存在");
  await api.updateUser(id, {
    username: user.username,
    email: user.email || "",
    role: user.role,
    disabled,
  });
  await loadUsers();
}

// run 统一处理异步动作状态和错误提示。
async function run(task: () => Promise<void>) {
  state.error = "";
  state.message = "";
  try {
    await task();
    if (!state.message) state.message = "操作完成";
  } catch (error) {
    state.error = error instanceof Error ? error.message : "操作失败";
  }
  render();
}

// copyText 将访问地址复制到剪贴板，必要时使用旧式复制降级。
async function copyText(text: string) {
  if (!text) throw new Error("没有可复制的地址");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

// summaryItem 渲染项目概要字段。
function summaryItem(label: string, value: string) {
  return `<div class="summary-item"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
}

// option 渲染 select 选项。
function option(value: string, label: string, current: string) {
  return `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`;
}

// roleLabel 返回用户角色的中文展示文案。
function roleLabel(role: string) {
  return role === "admin" ? "管理员" : "用户";
}

// activeStateLabel 返回项目整体运行状态文案。
function activeStateLabel(active: boolean) {
  return active ? "运行中" : "已停用";
}

// accessModeLabel 返回访问模式的中文展示文案。
function accessModeLabel(mode: AccessMode | string) {
  const labels: Record<string, string> = { path: "路径", mount: "挂载", port: "端口" };
  return labels[mode] || mode;
}

// shareStateLabel 返回分享状态的中文展示文案。
function shareStateLabel(value: ShareState | string) {
  const labels: Record<string, string> = { public: "公开", share: "令牌分享", unshared: "不分享" };
  return labels[value] || value;
}

// formatSize 格式化字节大小。
function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

// formatDate 格式化日期时间。
function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

// escapeHTML 转义 HTML 文本。
function escapeHTML(value: string) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

// escapeAttr 转义 HTML 属性。
function escapeAttr(value: string) {
  return escapeHTML(value || "");
}

// urlHost 将 IPv6 主机包装为 URL 可用格式。
function urlHost(value: string) {
  return value.includes(":") && !value.startsWith("[") ? `[${value}]` : value;
}

void init();
