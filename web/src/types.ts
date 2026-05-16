// 文件功能描述：定义管理前端调用 API 时使用的数据类型。
export type Role = "admin" | "user";
export type ShareState = "public" | "share" | "unshared";
export type AccessMode = "path" | "mount" | "port";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
}

export interface Project {
  id: number;
  ownerId: number;
  name: string;
  slug: string;
  shareState: ShareState;
  entryFile: string;
  spaEnabled: boolean;
  detectedBaseUrl: string;
  mountPath: string;
  port: number;
  accessMode: AccessMode;
  active: boolean;
  currentVersionId: number;
  createdAt: string;
  updatedAt: string;
  accessUrl: string;
  shareUrl?: string;
  warnings: string[] | null;
}

export interface ProjectVersion {
  id: number;
  projectId: number;
  versionNumber: number;
  sourceType: string;
  sizeBytes: number;
  detectedBaseUrl: string;
  warnings: string[] | null;
  createdBy: number;
  createdAt: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface PublicHostInfo {
  publicHost: string;
  candidates: string[];
}
