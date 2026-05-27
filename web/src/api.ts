// 文件功能描述：封装管理前端的 API 请求、上传和错误处理。
import type { FileEntry, NetworkSettings, Project, ProjectVersion, PublicHostInfo, User } from "./types";

export interface APIError extends Error {
  status?: number;
}

interface FolderUploadItem {
  file: File;
  path: string;
}

// request 发送 JSON 请求并解析响应，失败时抛出带状态码的错误。
export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const err = new Error(data.error || "请求失败") as APIError;
    err.status = response.status;
    throw err;
  }
  return data as T;
}

// uploadFile 使用 multipart/form-data 上传 ZIP 或 HTML 文件。
export function uploadFile<T>(url: string, file: File): Promise<T> {
  const body = new FormData();
  body.set("file", file);
  return request<T>(url, { method: "POST", body });
}

// uploadFolder 使用 multipart/form-data 上传文件夹中的多文件构建产物。
export function uploadFolder<T>(url: string, files: FileList | File[]): Promise<T> {
  const items = normalizeFolderFiles(files);
  const body = new FormData();
  body.set(
    "manifest",
    JSON.stringify({
      files: items.map((item, index) => ({ field: `file_${index}`, path: item.path, size: item.file.size })),
    }),
  );
  items.forEach((item, index) => body.append(`file_${index}`, item.file, item.file.name));
  return request<T>(url, { method: "POST", body });
}

// normalizeFolderFiles 生成服务端写入需要的项目内相对路径。
function normalizeFolderFiles(files: FileList | File[]): FolderUploadItem[] {
  const items = Array.from(files)
    .map((file) => ({ file, path: normalizeFolderPath(file) }))
    .filter((item) => item.path);
  if (!items.length) throw new Error("请选择包含文件的文件夹");
  return items;
}

// normalizeFolderPath 去掉浏览器文件夹选择产生的首层目录名。
function normalizeFolderPath(file: File) {
  const raw = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replaceAll("\\", "/");
  const parts = raw.split("/").filter(Boolean);
  if (parts.length > 1) return parts.slice(1).join("/");
  return parts[0] || "";
}

export const api = {
  me: () => request<{ user: User }>("/api/me"),
  updateMe: (payload: { email: string }) =>
    request<{ user: User }>("/api/me", { method: "PATCH", body: JSON.stringify(payload) }),
  changeOwnPassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/api/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  login: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  users: () => request<{ users: User[] }>("/api/users"),
  createUser: (payload: { username: string; email: string; password: string; role: string }) =>
    request<{ user: User }>("/api/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: { username: string; email: string; role: string; disabled: boolean }) =>
    request<{ user: User }>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  resetPassword: (id: number, password: string) =>
    request<{ ok: boolean }>(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  projects: () => request<{ projects: Project[] }>("/api/projects"),
  createProject: (payload: { name: string; slug?: string; tags?: string[] }) =>
    request<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (id: number, payload: Record<string, unknown>) =>
    request<{ project: Project }>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  activateProject: (id: number) => request<{ project: Project }>(`/api/projects/${id}/activate`, { method: "POST" }),
  deactivateProject: (id: number) => request<{ project: Project }>(`/api/projects/${id}/deactivate`, { method: "POST" }),
  deleteProject: (id: number) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  publishZip: (id: number, file: File) => uploadFile<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/publish/zip`, file),
  publishHtml: (id: number, file: File) => uploadFile<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/publish/html`, file),
  publishFolder: (id: number, files: FileList | File[]) =>
    uploadFolder<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/publish/folder`, files),
  packageExeUrl: (id: number) => `/api/projects/${id}/packages/exe`,
  versions: (id: number) => request<{ versions: ProjectVersion[] }>(`/api/projects/${id}/versions`),
  activateVersion: (id: number, versionId: number) =>
    request<{ project: Project }>(`/api/projects/${id}/versions/${versionId}/activate`, { method: "POST" }),
  deleteVersion: (id: number, versionId: number) =>
    request<{ project: Project }>(`/api/projects/${id}/versions/${versionId}`, { method: "DELETE" }),
  files: (id: number, path: string) => request<{ files: FileEntry[] }>(`/api/projects/${id}/files?path=${encodeURIComponent(path)}`),
  putFile: (id: number, path: string, file: File) =>
    fetch(`/api/projects/${id}/files?path=${encodeURIComponent(path)}`, {
      method: "PUT",
      body: file,
      credentials: "same-origin",
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "上传失败");
      return data as { project: Project; version: ProjectVersion };
    }),
  deleteFile: (id: number, path: string) =>
    request<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" }),
  shareKey: (id: number) => request<{ project: Project; key: string; shareUrl: string }>(`/api/projects/${id}/share-key`, { method: "POST" }),
  publicHost: () => request<PublicHostInfo>("/api/system/public-host"),
  updatePublicHost: (publicHost: string) =>
    request<PublicHostInfo>("/api/system/public-host", { method: "PATCH", body: JSON.stringify({ publicHost }) }),
  networkSettings: () => request<{ network: NetworkSettings }>("/api/system/network"),
  updateNetworkSettings: (payload: { sharePort: number; portStart: number; portEnd: number }) =>
    request<{ network: NetworkSettings }>("/api/system/network", { method: "PATCH", body: JSON.stringify(payload) }),
};
