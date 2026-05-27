// 文件功能描述：渲染项目名称、标识、路径、分享状态和 SPA fallback 设置表单。
import { FormEvent, useState } from "react";
import { Save } from "lucide-react";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { AccessMode, Project, ShareState } from "../../types";
import { Button, Panel, PanelHead, inputClass, labelClass, selectClass } from "../../ui";
import { parseTagsInput, tagsInputValue } from "../../utils/format";
import { TagPicker } from "./TagPicker";

// SettingsTab 管理项目低频配置保存。
export function SettingsTab({ app, project }: { app: ConsoleController; project: Project }) {
  const [tagsValue, setTagsValue] = useState(tagsInputValue(project.tags));

  // handleSubmit 读取设置表单并调用项目更新接口。
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void app.saveSettings({
      name: String(data.get("name")),
      slug: String(data.get("slug")),
      tags: parseTagsInput(tagsValue),
      entryFile: String(data.get("entryFile")),
      mountPath: String(data.get("mountPath")),
      accessMode: String(data.get("accessMode")) as AccessMode,
      shareState: String(data.get("shareState")) as ShareState,
      spaEnabled: Boolean(data.get("spaEnabled")),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Panel>
        <PanelHead title="项目设置" meta="低频配置" />
        <div className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>
            名称
            <input className={inputClass} name="name" defaultValue={project.name} />
          </label>
          <label className={labelClass}>
            项目标识
            <input className={inputClass} name="slug" defaultValue={project.slug} />
          </label>
          <div className="grid gap-2 md:col-span-2">
            <label className={labelClass}>
              标签
              <input className={inputClass} name="tags" value={tagsValue} onChange={(event) => setTagsValue(event.target.value)} placeholder="例如：客户A, 演示, 已上线" />
            </label>
            <TagPicker tags={app.availableProjectTags} value={tagsValue} onChange={setTagsValue} />
          </div>
          <label className={labelClass}>
            入口文件
            <input className={inputClass} name="entryFile" defaultValue={project.entryFile} />
          </label>
          <label className={labelClass}>
            挂载路径
            <input className={inputClass} name="mountPath" defaultValue={project.mountPath} placeholder="/demo/" />
          </label>
          <label className={labelClass}>
            访问模式
            <select className={selectClass} name="accessMode" defaultValue={project.accessMode}>
              <option value="path">路径</option>
              <option value="mount">挂载路径</option>
              <option value="port">独立端口</option>
            </select>
          </label>
          <label className={labelClass}>
            分享状态
            <select className={selectClass} name="shareState" defaultValue={project.shareState}>
              <option value="public">公开</option>
              <option value="share">密钥分享</option>
              <option value="unshared">不分享</option>
            </select>
          </label>
        </div>
        <label className="flex w-fit cursor-pointer select-none items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 has-[:checked]:border-teal-200 has-[:checked]:bg-teal-50 has-[:checked]:text-teal-700">
          <input className="h-4 w-4 accent-teal-700" name="spaEnabled" type="checkbox" defaultChecked={project.spaEnabled} />
          SPA fallback
        </label>
        <div className="flex justify-end">
          <Button variant="primary" icon={Save} type="submit" disabled={app.isPending("form:settings")}>
            {app.isPending("form:settings") ? "处理中" : "保存设置"}
          </Button>
        </div>
      </Panel>
    </form>
  );
}
