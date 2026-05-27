// 文件功能描述：提供管理后台展示文案、时间、体积、标签和样式拼接工具函数。
import type { AccessMode, ShareState } from "../types";

// classNames 合并条件样式类，过滤空值。
export function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

// roleLabel 返回用户角色的中文展示文案。
export function roleLabel(role: string) {
  return role === "admin" ? "管理员" : "用户";
}

// activeStateLabel 返回项目整体运行状态文案。
export function activeStateLabel(active: boolean) {
  return active ? "运行中" : "已停用";
}

// accessModeLabel 返回访问模式的中文展示文案。
export function accessModeLabel(mode: AccessMode | string) {
  const labels: Record<string, string> = { path: "路径", mount: "挂载", port: "端口" };
  return labels[mode] || mode;
}

// shareStateLabel 返回分享状态的中文展示文案。
export function shareStateLabel(value: ShareState | string) {
  const labels: Record<string, string> = { public: "公开", share: "密钥分享", unshared: "不分享" };
  return labels[value] || value;
}

// formatSize 将字节数格式化为便于阅读的容量文本。
export function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

// formatDate 将接口时间格式化为中文本地时间。
export function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

// parseTagsInput 将逗号分隔的标签文本转换为 API 需要的数组。
export function parseTagsInput(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// tagsInputValue 将项目标签数组还原为设置表单中的逗号分隔文本。
export function tagsInputValue(tags: string[] | null | undefined) {
  return (tags ?? []).join(", ");
}

// selectedFolderName 从浏览器提供的相对路径中提取被选中的文件夹名。
export function selectedFolderName(files: File[]) {
  const first = files[0] as File & { webkitRelativePath?: string };
  const root = (first.webkitRelativePath || "").replaceAll("\\", "/").split("/").filter(Boolean)[0];
  return root || "已选文件夹";
}

// urlHost 将 IPv6 主机包装为 URL 可用格式。
export function urlHost(value: string) {
  return value.includes(":") && !value.startsWith("[") ? `[${value}]` : value;
}
