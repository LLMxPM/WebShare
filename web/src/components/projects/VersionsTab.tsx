// 文件功能描述：渲染项目历史版本列表和版本激活、删除操作。
import { CheckCircle2, Trash2 } from "lucide-react";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { Project, ProjectVersion } from "../../types";
import { Button, Panel, PanelHead } from "../../ui";
import { formatDate, formatSize } from "../../utils/format";

// VersionsTab 展示历史版本和回滚操作。
export function VersionsTab({ app, project }: { app: ConsoleController; project: Project }) {
  return (
    <Panel>
      <PanelHead title="版本历史" meta={`${app.state.versions.length} 条`} />
      <div className="grid max-h-[520px] overflow-auto">
        {app.state.versions.length ? app.state.versions.map((version) => <VersionRow app={app} key={version.id} project={project} version={version} />) : <p className="py-4 text-sm text-slate-500">暂无版本</p>}
      </div>
    </Panel>
  );
}

// VersionRow 渲染单个历史版本行。
function VersionRow({ app, project, version }: { app: ConsoleController; project: Project; version: ProjectVersion }) {
  const active = version.id === project.currentVersionId;
  return (
    <div className="grid min-h-12 gap-3 border-b border-slate-100 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(120px,0.8fr)_auto] sm:items-center">
      <div className="grid min-w-0 gap-1">
        <strong className="text-slate-950">#{version.versionNumber}</strong>
        <span className="min-w-0 break-words text-sm text-slate-500">
          {version.sourceType} · {formatSize(version.sizeBytes)} · {formatDate(version.createdAt)}
        </span>
      </div>
      <span className="min-w-0 break-words text-sm text-slate-500">{version.detectedBaseUrl || "未识别"}</span>
      <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
        <Button icon={CheckCircle2} type="button" onClick={() => void app.activateVersion(version.id)} disabled={active || app.isPending(`version:activate:${version.id}`)}>
          激活
        </Button>
        <Button variant="danger" icon={Trash2} type="button" onClick={() => void app.deleteVersion(version.id)} disabled={app.isPending(`version:delete:${version.id}`)}>
          删除
        </Button>
      </div>
    </div>
  );
}
