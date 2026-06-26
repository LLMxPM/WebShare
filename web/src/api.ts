// 文件功能描述：封装管理前端的 API 请求、上传和错误处理。
import type { UploadProgress } from "./appTypes";
import type { FileEntry, NetworkSettings, Project, ProjectVersion, PublicHostInfo, User } from "./types";

export interface APIError extends Error {
  status?: number;
}

interface FolderUploadItem {
  file: File;
  path: string;
}

type UploadProgressHandler = (progress: UploadProgress) => void;

const maxFolderUploadFiles = 900;

// request 发送 JSON 请求并解析响应，失败时抛出带状态码的错误。
export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new Error("网络请求失败，可能是服务端中断、上传过大或连接超时");
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const err = new Error(data.error || "请求失败") as APIError;
    err.status = response.status;
    throw err;
  }
  return data as T;
}

// requestUpload 使用 XMLHttpRequest 发送上传请求，以便读取浏览器上传进度。
function requestUpload<T>(url: string, body: FormData, onProgress?: UploadProgressHandler): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : 0;
      onProgress({
        loaded: event.loaded,
        total,
        percent: total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : null,
      });
    };
    xhr.onload = () => {
      const text = xhr.responseText || "{}";
      const data = JSON.parse(text);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
        return;
      }
      const err = new Error(data.error || "上传失败") as APIError;
      err.status = xhr.status;
      reject(err);
    };
    xhr.onerror = () => reject(new Error("上传连接中断，可能是文件过大、文件数量过多或服务端已停止"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.send(body);
  });
}

// uploadFile 使用 multipart/form-data 上传 ZIP 或 HTML 文件。
export function uploadFile<T>(url: string, file: File, onProgress?: UploadProgressHandler): Promise<T> {
  const body = new FormData();
  body.set("file", file);
  return requestUpload<T>(url, body, onProgress);
}

// uploadFolder 使用 multipart/form-data 上传文件夹中的多文件构建产物。
export function uploadFolder<T>(url: string, files: FileList | File[], onProgress?: UploadProgressHandler): Promise<T> {
  const items = normalizeFolderFiles(files);
  validateFolderUpload(items);
  const body = new FormData();
  body.set(
    "manifest",
    JSON.stringify({
      files: items.map((item, index) => ({ field: `file_${index}`, path: item.path, size: item.file.size })),
    }),
  );
  items.forEach((item, index) => body.append(`file_${index}`, item.file, item.file.name));
  return requestUpload<T>(url, body, onProgress);
}

// normalizeFolderFiles 生成服务端写入需要的项目内相对路径。
function normalizeFolderFiles(files: FileList | File[]): FolderUploadItem[] {
  const items = Array.from(files)
    .map((file) => ({ file, path: normalizeFolderPath(file) }))
    .filter((item) => item.path);
  if (!items.length) throw new Error("请选择包含文件的文件夹");
  return items;
}

// validateFolderUpload 提前拦截容易触发 multipart part 数量限制的文件夹。
function validateFolderUpload(items: FolderUploadItem[]) {
  if (items.length > maxFolderUploadFiles) {
    throw new Error(`文件夹包含 ${items.length} 个文件，当前最多支持 ${maxFolderUploadFiles} 个；请先打包 ZIP 后上传`);
  }
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
  publishZip: (id: number, file: File, onProgress?: UploadProgressHandler) =>
    uploadFile<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/publish/zip`, file, onProgress),
  publishHtml: (id: number, file: File, onProgress?: UploadProgressHandler) =>
    uploadFile<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/publish/html`, file, onProgress),
  publishFolder: (id: number, files: FileList | File[], onProgress?: UploadProgressHandler) =>
    uploadFolder<{ project: Project; version: ProjectVersion }>(`/api/projects/${id}/publish/folder`, files, onProgress),
  packageExeUrl: (id: number) => `/api/projects/${id}/packages/exe`,
  versions: (id: number) => request<{ versions: ProjectVersion[] }>(`/api/projects/${id}/versions`),
  activateVersion: (id: number, versionId: number) =>
    request<{ project: Project }>(`/api/projects/${id}/versions/${versionId}/activate`, { method: "POST" }),
  updateVersionPinned: (id: number, versionId: number, pinned: boolean) =>
    request<{ version: ProjectVersion }>(`/api/projects/${id}/versions/${versionId}`, { method: "PATCH", body: JSON.stringify({ pinned }) }),
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
