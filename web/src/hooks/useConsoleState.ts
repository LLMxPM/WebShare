// 文件功能描述：集中管理管理后台登录态、项目、用户、分享地址和异步操作状态。
import { useCallback, useMemo, useReducer, useRef } from "react";
import { api } from "../api";
import type { AccountModalFocus, ActiveView, ProjectTab, ShareFilter, UploadSelection, UserModal } from "../appTypes";
import type { FileEntry, NetworkSettings, Project, ProjectVersion, PublicHostInfo, User } from "../types";
import { useToast, type ToastType } from "../toast";
import { collectProjectTags, copyText, filterProjects, filterUsers, publishUpload, toggleTag } from "./consoleHelpers";

interface ConsoleState {
  bootstrapped: boolean;
  me: User | null;
  users: User[];
  projects: Project[];
  selectedId: number | null;
  versions: ProjectVersion[];
  files: FileEntry[];
  publicHostInfo: PublicHostInfo | null;
  networkSettings: NetworkSettings | null;
  filePath: string;
  activeView: ActiveView;
  activeProjectTab: ProjectTab;
  projectSearch: string;
  projectShareFilter: ShareFilter;
  projectTagFilters: string[];
  createModalOpen: boolean;
  accountModalOpen: boolean;
  accountModalFocus: AccountModalFocus;
  userSearch: string;
  userModal: UserModal | null;
  shareUrl: string;
  pendingKeys: string[];
}

type StatePatch = Partial<ConsoleState> | ((state: ConsoleState) => Partial<ConsoleState>);

const initialState: ConsoleState = {
  bootstrapped: false,
  me: null,
  users: [],
  projects: [],
  selectedId: null,
  versions: [],
  files: [],
  publicHostInfo: null,
  networkSettings: null,
  filePath: "",
  activeView: "projects",
  activeProjectTab: "overview",
  projectSearch: "",
  projectShareFilter: "all",
  projectTagFilters: [],
  createModalOpen: false,
  accountModalOpen: false,
  accountModalFocus: "email",
  userSearch: "",
  userModal: null,
  shareUrl: "",
  pendingKeys: [],
};

// reducer 用部分更新模拟集中状态层，避免组件分散维护业务状态。
function reducer(state: ConsoleState, patch: StatePatch): ConsoleState {
  const next = typeof patch === "function" ? patch(state) : patch;
  return { ...state, ...next };
}

// useConsoleState 暴露页面所需的状态派生值和所有 API 动作。
export function useConsoleState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const { showToast } = useToast();
  stateRef.current = state;

  const setState = useCallback((patch: StatePatch) => dispatch(patch), []);

  const selectedProject = useMemo(() => state.projects.find((project) => project.id === state.selectedId) || null, [state.projects, state.selectedId]);
  const availableProjectTags = useMemo(() => collectProjectTags(state.projects), [state.projects]);
  const filteredProjects = useMemo(() => filterProjects(state.projects, state.projectSearch, state.projectShareFilter, state.projectTagFilters), [state.projects, state.projectSearch, state.projectShareFilter, state.projectTagFilters]);
  const filteredUsers = useMemo(() => filterUsers(state.users, state.userSearch), [state.users, state.userSearch]);

  const isPending = useCallback((key: string) => stateRef.current.pendingKeys.includes(key), []);

  const loadSelectedData = useCallback(async (projects: Project[], selectedId: number | null, filePath: string) => {
    const project = projects.find((item) => item.id === selectedId);
    if (!project?.currentVersionId) return { versions: [], files: [] };
    const [{ versions }, { files }] = await Promise.all([api.versions(project.id), api.files(project.id, filePath)]);
    return { versions: versions ?? [], files: files ?? [] };
  }, []);

  const refreshAll = useCallback(
    async (patch: StatePatch = {}) => {
      const current = stateRef.current;
      const basePatch = typeof patch === "function" ? patch(current) : patch;
      const me = basePatch.me ?? current.me;
      if (!me) return;
      const isAdmin = me.role === "admin";
      let activeView = basePatch.activeView ?? current.activeView;
      if ((activeView === "users" || activeView === "share") && !isAdmin) activeView = "projects";
      const adminPromise = isAdmin ? Promise.all([api.users(), api.publicHost(), api.networkSettings()]) : Promise.resolve(null);
      const [{ projects }, adminData] = await Promise.all([api.projects(), adminPromise]);
      const nextProjects = projects ?? [];
      const tags = new Set(collectProjectTags(nextProjects).map((tag) => tag.toLowerCase()));
      const projectTagFilters = (basePatch.projectTagFilters ?? current.projectTagFilters).filter((tag) => tags.has(tag.toLowerCase()));
      let selectedId = basePatch.selectedId ?? current.selectedId;
      if (!selectedId || !nextProjects.some((project) => project.id === selectedId)) selectedId = nextProjects[0]?.id ?? null;
      const filePath = basePatch.filePath ?? current.filePath;
      const selectedData = await loadSelectedData(nextProjects, selectedId, filePath);
      const [usersResult, publicHostInfo, networkResult] = adminData ?? [];
      setState({
        ...basePatch,
        bootstrapped: true,
        me,
        users: usersResult?.users ?? current.users,
        publicHostInfo: publicHostInfo ?? current.publicHostInfo,
        networkSettings: networkResult?.network ?? current.networkSettings,
        activeView,
        projects: nextProjects,
        selectedId,
        projectTagFilters,
        filePath,
        versions: selectedData.versions,
        files: selectedData.files,
      });
    },
    [loadSelectedData, setState],
  );

  const run = useCallback(
    async (key: string, task: () => Promise<string | false | void>, defaultMessage = "操作完成") => {
      if (stateRef.current.pendingKeys.includes(key)) return;
      setState((current) => ({ pendingKeys: [...current.pendingKeys, key] }));
      let toastMessage = "";
      let toastType: ToastType = "success";
      try {
        const result = await task();
        toastMessage = result === false ? "" : result || defaultMessage;
      } catch (error) {
        toastType = "error";
        toastMessage = error instanceof Error ? error.message : "操作失败";
      } finally {
        setState((current) => ({ pendingKeys: current.pendingKeys.filter((item) => item !== key) }));
      }
      if (toastMessage) showToast(toastMessage, toastType);
    },
    [setState, showToast],
  );

  const initialize = useCallback(async () => {
    try {
      const { user } = await api.me();
      await refreshAll({ me: user });
    } catch {
      setState({ bootstrapped: true, me: null });
    }
  }, [refreshAll, setState]);

  const refreshSelected = useCallback(
    async (selectedId = stateRef.current.selectedId, filePath = stateRef.current.filePath) => {
      const data = await loadSelectedData(stateRef.current.projects, selectedId, filePath);
      setState({ selectedId, filePath, versions: data.versions, files: data.files });
    },
    [loadSelectedData, setState],
  );

  return {
    state,
    selectedProject,
    availableProjectTags,
    filteredProjects,
    filteredUsers,
    isPending,
    initialize,
    setState,
    setProjectSearch: (projectSearch: string) => setState({ projectSearch }),
    setShareFilter: (projectShareFilter: ShareFilter) => setState({ projectShareFilter }),
    setUserSearch: (userSearch: string) => setState({ userSearch }),
    setProjectTab: (activeProjectTab: ProjectTab) => setState({ activeProjectTab }),
    openCreateModal: () => setState({ createModalOpen: true, accountModalOpen: false }),
    closeCreateModal: () => setState({ createModalOpen: false }),
    openAccountModal: () => setState({ accountModalOpen: true, accountModalFocus: "email", createModalOpen: false, userModal: null }),
    closeAccountModal: () => setState({ accountModalOpen: false }),
    setAccountFocus: (accountModalFocus: AccountModalFocus) => setState({ accountModalFocus }),
    openUserModal: (userModal: UserModal) => setState({ userModal, accountModalOpen: false }),
    closeUserModal: () => setState({ userModal: null }),
    toggleProjectTagFilter: (tag: string) => setState((current) => ({ projectTagFilters: toggleTag(current.projectTagFilters, tag) })),
    clearProjectTagFilters: () => setState({ projectTagFilters: [] }),
    setView: (activeView: ActiveView) => refreshAll({ activeView, createModalOpen: false, accountModalOpen: false, userModal: null }),
    selectProject: (selectedId: number) => refreshSelected(selectedId, "").then(() => setState({ shareUrl: "", activeProjectTab: "overview" })),
    openPath: (filePath: string) => refreshSelected(stateRef.current.selectedId, filePath),
    login: (username: string, password: string) =>
      run("form:login", async () => {
        const { user } = await api.login(username, password);
        await refreshAll({ me: user, activeView: "projects" });
      }),
    logout: () =>
      run("action:logout", async () => {
        await api.logout();
        setState({ me: null, activeView: "projects", selectedId: null, accountModalOpen: false });
      }),
    createProject: (name: string, tags: string[], upload: UploadSelection | null) =>
      run("form:project", async () => {
        const { project } = await api.createProject({ name, tags });
        await refreshAll({ selectedId: project.id, activeProjectTab: "overview", createModalOpen: false });
        if (upload) await publishUpload(project.id, upload);
        if (upload) await refreshAll({ selectedId: project.id, activeProjectTab: "overview", createModalOpen: false });
      }),
    saveSettings: (payload: Record<string, unknown>) =>
      run("form:settings", async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project) return false;
        await api.updateProject(project.id, payload);
        await refreshAll({ activeProjectTab: "overview" });
      }),
    publishProject: (upload: UploadSelection) =>
      run(`publish:${stateRef.current.selectedId || 0}:${upload.kind}`, async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project) return false;
        await publishUpload(project.id, upload);
        await refreshAll({ activeProjectTab: "overview" });
      }),
    uploadManagedFile: (path: string, file: File) =>
      run("form:file", async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project) return false;
        await api.putFile(project.id, path, file);
        await refreshAll({ activeProjectTab: "files" });
      }),
    copyAccessLink: (url: string) => run(`copy:${url}`, async () => copyText(url).then(() => "访问地址已复制")),
    shareKey: () =>
      run("action:share-key", async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project) return false;
        const result = await api.shareKey(project.id);
        await refreshAll({ shareUrl: result.shareUrl });
        return "分享密钥已生成";
      }),
    activateProject: () =>
      run("action:activate-project", async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project) return false;
        await api.activateProject(project.id);
        await refreshAll();
      }),
    deactivateProject: () =>
      run("action:deactivate-project", async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project || !window.confirm("确认停用该项目？")) return false;
        await api.deactivateProject(project.id);
        await refreshAll();
      }),
    deleteProject: () =>
      run("action:delete-project", async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project || !window.confirm("确认删除该项目？")) return false;
        await api.deleteProject(project.id);
        await refreshAll({ selectedId: null });
      }),
    activateVersion: (versionId: number) =>
      run(`version:activate:${versionId}`, async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project) return false;
        await api.activateVersion(project.id, versionId);
        await refreshAll({ activeProjectTab: "overview" });
      }),
    deleteVersion: (versionId: number) =>
      run(`version:delete:${versionId}`, async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project || !window.confirm("确认删除该版本？如果这是当前版本，系统会自动切换到最近的剩余版本。")) return false;
        await api.deleteVersion(project.id, versionId);
        await refreshAll({ activeProjectTab: "versions" });
        return "版本已删除";
      }),
    deleteFile: (path: string) =>
      run(`file:delete:${path}`, async () => {
        const project = stateRef.current.projects.find((item) => item.id === stateRef.current.selectedId);
        if (!project || !window.confirm("确认删除该路径？")) return false;
        await api.deleteFile(project.id, path);
        await refreshAll({ activeProjectTab: "files" });
      }),
    saveAccountEmail: (email: string) =>
      run("form:account-email", async () => {
        const { user } = await api.updateMe({ email });
        const users = user.role === "admin" ? (await api.users()).users ?? [] : stateRef.current.users;
        setState({ me: user, users });
        return "邮箱已保存";
      }),
    changeOwnPassword: (currentPassword: string, newPassword: string) =>
      run("form:account-password", async () => {
        await api.changeOwnPassword(currentPassword, newPassword);
        return "密码已修改";
      }),
    createUser: (payload: { username: string; email: string; password: string; role: string }) =>
      run("form:user-create", async () => {
        await api.createUser(payload);
        const { users } = await api.users();
        setState({ users: users ?? [], userModal: null });
      }),
    saveUser: (id: number, payload: { username: string; email: string; role: string; disabled: boolean }) =>
      run(`form:user-edit:${id}`, async () => {
        const { user } = await api.updateUser(id, payload);
        const { users } = await api.users();
        setState({ users: users ?? [], userModal: null, me: stateRef.current.me?.id === user.id ? user : stateRef.current.me });
      }),
    resetUserPassword: (id: number, password: string) =>
      run(`form:user-reset:${id}`, async () => {
        await api.resetPassword(id, password);
        const { users } = await api.users();
        setState({ users: users ?? [], userModal: null });
      }),
    toggleUser: (id: number, disabled: boolean) =>
      run(`user:toggle:${id}`, async () => {
        const user = stateRef.current.users.find((item) => item.id === id);
        if (!user) throw new Error("用户不存在");
        await api.updateUser(id, { username: user.username, email: user.email || "", role: user.role, disabled });
        const { users } = await api.users();
        setState({ users: users ?? [] });
      }),
    updatePublicHost: (publicHost: string) =>
      run("form:public-host", async () => {
        await api.updatePublicHost(publicHost);
        await refreshAll();
      }),
    updateNetworkSettings: (payload: { sharePort: number; portStart: number; portEnd: number }) =>
      run("form:network-settings", async () => {
        const { network } = await api.updateNetworkSettings(payload);
        await refreshAll({ networkSettings: network });
        return network.restartRequired ? "端口配置已保存，重启软件后生效" : "端口配置已保存";
      }),
  };
}

export type ConsoleController = ReturnType<typeof useConsoleState>;
