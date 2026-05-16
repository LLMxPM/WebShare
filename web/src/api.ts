// 文件功能描述：封装管理前端的 API 请求、上传和错误处理。
import type { FileEntry, Project, ProjectVersion, PublicHostInfo, User } from "./types";

export interface APIError extends Error {
  status?: number;
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

export const api = {
  me: () => request<{ user: User }>("/api/me"),
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
  createProject: (payload: { name: string; slug?: string }) =>
    request<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (id: number, payload: Record<string, unknown>) =>
    request<{ project: Project }>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  activateProject: (id: number) => request<{ project: Project }>(`/api/projects/${id}/activate`, { method: "POST" }),
  deactivateProject: (id: number) => request<{ project: Project }>(`/api/projects/${id}/deactivate`, { method: "POST" }),
  deleteProject: (id: number) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  publishZip: (id: number, file: File) => uploadFile<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/publish/zip`, file),
  publishHtml: (id: number, file: File) => uploadFile<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/publish/html`, file),
  packageExeUrl: (id: number) => `/api/projects/${id}/packages/exe`,
  versions: (id: number) => request<{ versions: ProjectVersion[] }>(`/api/projects/${id}/versions`),
  activateVersion: (id: number, versionId: number) =>
    request<{ project: Project }>(`/api/projects/${id}/versions/${versionId}/activate`, { method: "POST" }),
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
  shareToken: (id: number) => request<{ project: Project; token: string; shareUrl: string }>(`/api/projects/${id}/share-token`, { method: "POST" }),
  publicHost: () => request<PublicHostInfo>("/api/system/public-host"),
  updatePublicHost: (publicHost: string) =>
    request<PublicHostInfo>("/api/system/public-host", { method: "PATCH", body: JSON.stringify({ publicHost }) }),
};
