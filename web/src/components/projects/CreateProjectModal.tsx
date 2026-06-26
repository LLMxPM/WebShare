// 文件功能描述：渲染创建项目弹窗，并支持创建时选择首个发布内容。
import { FormEvent, useRef, useState } from "react";
import { FileArchive, FileCode2, FolderOpen, Plus } from "lucide-react";
import type { PublishKind, UploadProgress, UploadSelection } from "../../appTypes";
import type { ConsoleController } from "../../hooks/useConsoleState";
import { Button, Modal, inputClass, labelClass } from "../../ui";
import { formatSize } from "../../utils/format";
import { emptyUploadSummaries, readUploadSelection, uploadSummary } from "../../utils/uploads";
import { parseTagsInput } from "../../utils/format";
import { TagPicker } from "./TagPicker";

// CreateProjectModal 管理新建项目表单和三选一上传输入。
export function CreateProjectModal({ app }: { app: ConsoleController }) {
  const refs = useRef<Record<PublishKind, HTMLInputElement | null>>({ zip: null, folder: null, html: null });
  const [summaries, setSummaries] = useState(emptyUploadSummaries);
  const [tagsValue, setTagsValue] = useState("");
  const progress = app.state.uploadProgress["form:project"];
  const pending = app.isPending("form:project");

  // handleFileChange 更新摘要，并保证创建时 ZIP、文件夹和 HTML 只选择一种。
  function handleFileChange(kind: PublishKind, input: HTMLInputElement) {
    (Object.keys(refs.current) as PublishKind[]).forEach((item) => {
      if (item !== kind && refs.current[item]) refs.current[item]!.value = "";
    });
    setSummaries({
      zip: uploadSummary("zip", refs.current.zip?.files, true),
      folder: uploadSummary("folder", refs.current.folder?.files, true),
      html: uploadSummary("html", refs.current.html?.files, true),
      [kind]: uploadSummary(kind, input.files, true),
    });
  }

  // handleSubmit 创建项目，并把可选上传内容作为首个版本发布。
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const upload = selectedUpload(refs.current);
    void app.createProject(String(data.get("name")), parseTagsInput(tagsValue), upload);
  }

  return (
    <Modal eyebrow="新建项目" title="创建并发布" onClose={pending ? () => undefined : app.closeCreateModal} wide>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className={labelClass}>
          项目名称
          <input className={inputClass} name="name" placeholder="例如：后台管理系统" required autoFocus />
        </label>
        <label className={labelClass}>
          标签
          <input className={inputClass} name="tags" value={tagsValue} onChange={(event) => setTagsValue(event.target.value)} placeholder="例如：客户A, 演示, 已上线" />
        </label>
        <TagPicker tags={app.availableProjectTags} value={tagsValue} onChange={setTagsValue} />
        <div className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <strong className="text-sm text-slate-950">发布内容（可选）</strong>
            <span className="text-xs text-slate-500">项目标识会按日期和随机码自动生成。</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <UploadChoice kind="zip" icon={FileArchive} title="ZIP 构建产物" description="上传压缩后的构建目录。" summary={summaries.zip} refs={refs.current} onChange={handleFileChange} />
            <UploadChoice kind="folder" icon={FolderOpen} title="文件夹构建产物" description="直接选择 dist 文件夹。" summary={summaries.folder} refs={refs.current} onChange={handleFileChange} />
            <UploadChoice kind="html" icon={FileCode2} title="单 HTML 文件" description="保存为 index.html。" summary={summaries.html} refs={refs.current} onChange={handleFileChange} />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={app.closeCreateModal} disabled={pending}>
            取消
          </Button>
          <Button variant="primary" icon={Plus} type="submit" disabled={pending}>
            {pending ? createButtonText(progress) : "创建项目"}
          </Button>
        </div>
        {pending ? <CreateUploadProgress progress={progress} /> : null}
      </form>
    </Modal>
  );
}

// UploadChoice 渲染创建项目弹窗中的一种上传方式。
function UploadChoice({ kind, icon: Icon, title, description, summary, refs, onChange }: { kind: PublishKind; icon: typeof FileArchive; title: string; description: string; summary: string; refs: Record<PublishKind, HTMLInputElement | null>; onChange: (kind: PublishKind, input: HTMLInputElement) => void }) {
  return (
    <div className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-grid h-7 w-11 place-items-center rounded-full bg-teal-50 text-xs font-black text-teal-700">{kind === "folder" ? "DIR" : kind.toUpperCase()}</span>
        <strong className="min-w-0 break-words text-sm text-slate-950">{title}</strong>
      </div>
      <p className="min-h-9 text-xs text-slate-500">{description}</p>
      <label className="relative block">
        <input
          className="absolute h-px w-px opacity-0"
          ref={(node) => {
            refs[kind] = node;
            if (node && kind === "folder") {
              node.setAttribute("webkitdirectory", "");
              node.setAttribute("directory", "");
            }
          }}
          type="file"
          accept={kind === "zip" ? ".zip" : kind === "html" ? ".html,.htm,text/html" : undefined}
          multiple={kind === "folder"}
          onChange={(event) => onChange(kind, event.currentTarget)}
        />
        <span className="flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-bold text-slate-700 hover:border-teal-600 hover:text-teal-700">
          <Icon size={16} />
          {kind === "folder" ? "选择文件夹" : `选择 ${kind.toUpperCase()} 文件`}
        </span>
      </label>
      <div className="min-h-10 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 break-words">{summary}</div>
    </div>
  );
}

// selectedUpload 返回新建项目弹窗中当前选择的上传内容。
function selectedUpload(refs: Record<PublishKind, HTMLInputElement | null>): UploadSelection | null {
  return readUploadSelection("zip", refs.zip, true) ?? readUploadSelection("folder", refs.folder, true) ?? readUploadSelection("html", refs.html, true);
}

// CreateUploadProgress 展示创建项目时首个版本的上传进度。
function CreateUploadProgress({ progress }: { progress?: UploadProgress }) {
  const width = progress?.percent ?? 8;
  const text = progress ? (progress.total > 0 ? `${progress.percent}% · ${formatSize(progress.loaded)} / ${formatSize(progress.total)}` : `已上传 ${formatSize(progress.loaded)}`) : "正在创建项目...";
  return (
    <div className="grid gap-1 rounded-lg bg-slate-50 px-3 py-2">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-500">{text}</span>
    </div>
  );
}

// createButtonText 返回创建按钮在进行中的文案。
function createButtonText(progress?: UploadProgress) {
  if (!progress) return "处理中";
  return progress.percent === null ? "上传中" : `上传中 ${progress.percent}%`;
}
