// 文件功能描述：定义管理后台 React 版本的视图状态、弹窗和上传类型。
import type { ShareState } from "./types";

export type ActiveView = "projects" | "users" | "share";
export type ProjectTab = "overview" | "publish" | "files" | "versions" | "settings";
export type ShareFilter = "all" | ShareState;
export type UserModalMode = "create" | "edit" | "reset";
export type AccountModalFocus = "email" | "password";
export type PublishKind = "zip" | "folder" | "html";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number | null;
}

export interface UserModal {
  mode: UserModalMode;
  userId?: number;
}

export interface UploadSelection {
  kind: PublishKind;
  file?: File;
  files?: FileList | File[];
}
