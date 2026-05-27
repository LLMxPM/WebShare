// 文件功能描述：渲染项目文件浏览、路径切换、上传替换和删除操作。
import { FormEvent } from "react";
import { File as FileIcon, Folder, Trash2, Upload } from "lucide-react";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { FileEntry, Project } from "../../types";
import { Button, EmptyInline, Panel, PanelHead, inputClass } from "../../ui";
import { formatSize } from "../../utils/format";

// FilesTab 展示当前版本文件列表，并支持单文件上传替换。
export function FilesTab({ app, project }: { app: ConsoleController; project: Project }) {
  if (!project.currentVersionId) return <Panel><EmptyInline>当前项目还没有版本，发布后才能管理文件。</EmptyInline></Panel>;
  const parent = app.state.filePath.split("/").filter(Boolean).slice(0, -1).join("/");

  // handleSubmit 上传或替换当前项目中的单个文件。
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File)) return;
    void app.uploadManagedFile(String(data.get("path")), file);
  }

  return (
    <Panel>
      <PanelHead title="文件管理" meta={`${app.state.files.length} 项`} />
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
        <Button type="button" onClick={() => void app.openPath("")}>根目录</Button>
        {app.state.filePath ? <Button type="button" onClick={() => void app.openPath(parent)}>上级</Button> : null}
        <code className="min-w-0 break-words text-sm text-slate-600">/{app.state.filePath}</code>
      </div>
      <form className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] sm:items-end" onSubmit={handleSubmit}>
        <input className={inputClass} name="path" placeholder="保存路径，例如 assets/logo.png" required />
        <input className={inputClass} name="file" type="file" required />
        <Button variant="primary" icon={Upload} type="submit" disabled={app.isPending("form:file")}>
          {app.isPending("form:file") ? "处理中" : "上传/替换"}
        </Button>
      </form>
      <div className="grid max-h-[520px] overflow-auto">
        {app.state.files.length ? app.state.files.map((file) => <FileRow app={app} file={file} key={file.path} />) : <p className="py-4 text-sm text-slate-500">空目录</p>}
      </div>
    </Panel>
  );
}

// FileRow 渲染单个文件或目录行。
function FileRow({ app, file }: { app: ConsoleController; file: FileEntry }) {
  return (
    <div className="grid min-h-12 gap-3 border-b border-slate-100 py-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(120px,0.8fr)_auto] sm:items-center">
      <button className="inline-flex min-w-0 items-center justify-start gap-2 border-0 bg-transparent p-0 text-left" type="button" onClick={() => (file.isDir ? void app.openPath(file.path) : undefined)}>
        <span className="inline-grid h-6 min-w-10 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">{file.isDir ? <Folder size={14} /> : <FileIcon size={14} />}</span>
        <span className="min-w-0 truncate text-sm font-medium text-slate-900">{file.name}</span>
      </button>
      <span className="text-sm text-slate-500">{file.isDir ? "目录" : formatSize(file.size)}</span>
      <Button variant="danger" icon={Trash2} type="button" onClick={() => void app.deleteFile(file.path)} disabled={app.isPending(`file:delete:${file.path}`)}>
        删除
      </Button>
    </div>
  );
}
