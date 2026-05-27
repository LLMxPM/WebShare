// 文件功能描述：封装 ZIP、文件夹和 HTML 上传选择读取与摘要展示逻辑。
import type { PublishKind, UploadSelection } from "../appTypes";
import { formatSize, selectedFolderName } from "./format";

// uploadSummary 根据文件选择状态生成上传卡片的中文摘要。
export function uploadSummary(kind: PublishKind, files: FileList | null | undefined, createMode = false) {
  const items = Array.from(files ?? []);
  if (!items.length) return kind === "folder" ? "未选择文件夹" : "未选择文件";
  const pendingLabel = createMode ? "将随创建发布" : "待上传";
  if (kind !== "folder") return `${items[0].name} · ${formatSize(items[0].size)} · ${pendingLabel}`;
  const total = items.reduce((sum, file) => sum + file.size, 0);
  return `${selectedFolderName(items)} · ${items.length} 个文件 · ${formatSize(total)} · ${pendingLabel}`;
}

// readUploadSelection 从指定 input 中读取 API 上传需要的文件对象。
export function readUploadSelection(kind: PublishKind, input: HTMLInputElement | null, createMode = false): UploadSelection | null {
  if (kind === "folder") {
    const files = input?.files;
    if (!files?.length) return null;
    return { kind, files };
  }
  const file = input?.files?.[0];
  if (!file) return null;
  const name = file.name.toLowerCase();
  if (kind === "zip" && !name.endsWith(".zip")) throw new Error(createMode ? "创建时 ZIP 发布只支持 .zip 文件" : "ZIP 发布只支持 .zip 文件");
  if (kind === "html" && !name.endsWith(".html") && !name.endsWith(".htm")) {
    throw new Error(createMode ? "创建时 HTML 发布只支持 .html 或 .htm 文件" : "HTML 发布只支持 .html 或 .htm 文件");
  }
  return { kind, file };
}

// emptyUploadSummaries 返回三种上传方式的默认摘要。
export function emptyUploadSummaries() {
  return {
    zip: uploadSummary("zip", null),
    folder: uploadSummary("folder", null),
    html: uploadSummary("html", null),
  };
}
