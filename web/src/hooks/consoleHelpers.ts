// 文件功能描述：提供管理后台状态 hook 复用的筛选、标签切换、上传发布和复制工具。
import { api } from "../api";
import type { ShareFilter, UploadSelection } from "../appTypes";
import type { Project, User } from "../types";
import { roleLabel } from "../utils/format";

// collectProjectTags 汇总当前用户可见项目中的标签。
export function collectProjectTags(projects: Project[]) {
  const tags: string[] = [];
  const seen = new Set<string>();
  projects.forEach((project) => {
    (project.tags ?? []).forEach((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      tags.push(tag);
    });
  });
  return tags.sort((left, right) => left.localeCompare(right, "zh-CN"));
}

// filterProjects 返回搜索、分享状态和标签筛选后的项目列表。
export function filterProjects(projects: Project[], search: string, shareFilter: ShareFilter, tagFilters: string[]) {
  const keyword = search.trim().toLowerCase();
  const filters = tagFilters.map((tag) => tag.toLowerCase());
  return projects.filter((project) => {
    const tags = project.tags ?? [];
    const tagKeys = new Set(tags.map((tag) => tag.toLowerCase()));
    const matchesKeyword =
      !keyword ||
      project.name.toLowerCase().includes(keyword) ||
      project.slug.toLowerCase().includes(keyword) ||
      tags.some((tag) => tag.toLowerCase().includes(keyword));
    const matchesShare = shareFilter === "all" || project.shareState === shareFilter;
    const matchesTags = filters.every((tag) => tagKeys.has(tag));
    return matchesKeyword && matchesShare && matchesTags;
  });
}

// filterUsers 返回匹配用户名、邮箱和角色的用户列表。
export function filterUsers(users: User[], search: string) {
  const keyword = search.trim().toLowerCase();
  if (!keyword) return users;
  return users.filter((user) => {
    return user.username.toLowerCase().includes(keyword) || (user.email || "").toLowerCase().includes(keyword) || roleLabel(user.role).toLowerCase().includes(keyword);
  });
}

// toggleTag 切换标签筛选数组中的指定标签。
export function toggleTag(tags: string[], tag: string) {
  const value = tag.trim();
  if (!value) return tags;
  const key = value.toLowerCase();
  return tags.some((item) => item.toLowerCase() === key) ? tags.filter((item) => item.toLowerCase() !== key) : [...tags, value];
}

// publishUpload 按上传类型调用对应 API。
export async function publishUpload(projectId: number, upload: UploadSelection) {
  if (upload.kind === "folder") {
    if (!upload.files?.length) throw new Error("请选择文件夹");
    await api.publishFolder(projectId, upload.files);
    return;
  }
  if (!upload.file) throw new Error("请选择文件");
  if (upload.kind === "zip") await api.publishZip(projectId, upload.file);
  else await api.publishHtml(projectId, upload.file);
}

// copyText 将访问地址复制到剪贴板，必要时使用旧式复制降级。
export async function copyText(text: string) {
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
