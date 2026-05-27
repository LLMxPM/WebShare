// 文件功能描述：渲染项目 ZIP、文件夹和 HTML 三种发布方式。
import { useRef, useState } from "react";
import { FileArchive, FileCode2, FolderOpen, Upload } from "lucide-react";
import type { PublishKind } from "../../appTypes";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { Project } from "../../types";
import { Button, Panel, PanelHead } from "../../ui";
import { emptyUploadSummaries, readUploadSelection, uploadSummary } from "../../utils/uploads";

// PublishTab 展示三种上传卡片，并从 input ref 读取 FileList。
export function PublishTab({ app, project }: { app: ConsoleController; project: Project }) {
  const refs = useRef<Record<PublishKind, HTMLInputElement | null>>({ zip: null, folder: null, html: null });
  const [summaries, setSummaries] = useState(emptyUploadSummaries);

  // handleFileChange 更新当前上传卡片摘要。
  function handleFileChange(kind: PublishKind, input: HTMLInputElement) {
    setSummaries((current) => ({ ...current, [kind]: uploadSummary(kind, input.files) }));
  }

  // publish 读取当前上传方式的文件并调用发布接口。
  function publish(kind: PublishKind) {
    const upload = readUploadSelection(kind, refs.current[kind]);
    if (!upload) return;
    void app.publishProject(upload);
  }

  return (
    <Panel>
      <PanelHead title="发布项目" meta={`当前版本 ${project.currentVersionId || "-"}`} />
      <div className="grid gap-3 lg:grid-cols-3">
        <UploadCard kind="zip" icon={FileArchive} title="ZIP 构建产物" description="适合已经压缩好的 Vite、Vue、React、Webpack 构建目录。" summary={summaries.zip} refs={refs.current} pending={app.isPending(`publish:${project.id}:zip`)} onChange={handleFileChange} onPublish={publish} />
        <UploadCard kind="folder" icon={FolderOpen} title="文件夹构建产物" description="直接选择 dist 文件夹，系统会保留内部目录结构并创建完整版本。" summary={summaries.folder} refs={refs.current} pending={app.isPending(`publish:${project.id}:folder`)} onChange={handleFileChange} onPublish={publish} />
        <UploadCard kind="html" icon={FileCode2} title="单 HTML 文件" description="上传后会保存为 index.html，适合没有独立静态资源的页面。" summary={summaries.html} refs={refs.current} pending={app.isPending(`publish:${project.id}:html`)} onChange={handleFileChange} onPublish={publish} />
      </div>
    </Panel>
  );
}

// UploadCard 渲染单个发布方式的文件选择和上传按钮。
function UploadCard({ kind, icon: Icon, title, description, summary, refs, pending, onChange, onPublish }: { kind: PublishKind; icon: typeof FileArchive; title: string; description: string; summary: string; refs: Record<PublishKind, HTMLInputElement | null>; pending: boolean; onChange: (kind: PublishKind, input: HTMLInputElement) => void; onPublish: (kind: PublishKind) => void }) {
  const hasFile = !!refs[kind]?.files?.length;
  return (
    <div className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-grid h-7 w-11 place-items-center rounded-full bg-teal-50 text-xs font-black text-teal-700">{kind === "folder" ? "DIR" : kind.toUpperCase()}</span>
        <strong className="min-w-0 break-words text-sm text-slate-950">{title}</strong>
      </div>
      <p className="min-h-10 text-sm text-slate-500">{description}</p>
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
      <Button variant={kind === "html" ? "default" : "primary"} icon={Upload} type="button" onClick={() => onPublish(kind)} disabled={!hasFile || pending}>
        {pending ? "上传中" : kind === "folder" ? "上传所选文件夹" : `上传 ${kind.toUpperCase()}`}
      </Button>
    </div>
  );
}
