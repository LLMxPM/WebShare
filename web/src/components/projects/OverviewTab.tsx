// 文件功能描述：渲染项目概览页，包括运行状态、风险提示和快捷操作。
import { Download, FileCog, History, Upload } from "lucide-react";
import { api } from "../../api";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { Project } from "../../types";
import { Button, LinkButton, Panel, PanelHead } from "../../ui";
import { accessModeLabel, shareStateLabel } from "../../utils/format";

// OverviewTab 展示当前项目是否可访问和常用流程入口。
export function OverviewTab({ app, project }: { app: ConsoleController; project: Project }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <Panel>
        <PanelHead title="运行状态" meta={project.active ? (project.currentVersionId ? "已发布" : "等待发布") : "已停用"} />
        <Warnings items={project.warnings} />
        {!project.active ? (
          <StatusCard title="项目已停用" text={`访问模式为 ${accessModeLabel(project.accessMode)}，分享状态为 ${shareStateLabel(project.shareState)}。`} />
        ) : project.currentVersionId ? (
          <StatusCard success title="当前项目可访问" text={`访问模式为 ${accessModeLabel(project.accessMode)}，分享状态为 ${shareStateLabel(project.shareState)}。`} />
        ) : (
          <StatusCard title="还没有发布版本" text="上传 ZIP、文件夹构建产物或单 HTML 文件后，系统会识别 BaseURL 并生成访问地址。">
            <Button variant="primary" icon={Upload} type="button" onClick={() => app.setProjectTab("publish")}>
              去发布
            </Button>
          </StatusCard>
        )}
      </Panel>
      <Panel>
        <PanelHead title="快捷操作" meta="常用流程" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button icon={Upload} type="button" onClick={() => app.setProjectTab("publish")}>
            上传新版本
          </Button>
          <Button icon={FileCog} type="button" onClick={() => app.setProjectTab("files")} disabled={!project.currentVersionId}>
            管理文件
          </Button>
          <Button icon={History} type="button" onClick={() => app.setProjectTab("versions")} disabled={!app.state.versions.length}>
            查看版本
          </Button>
          {project.currentVersionId ? (
            <LinkButton icon={Download} href={api.packageExeUrl(project.id)}>
              下载 EXE
            </LinkButton>
          ) : (
            <Button type="button" disabled>
              下载 EXE
            </Button>
          )}
          <Button className="sm:col-span-2" type="button" onClick={() => app.setProjectTab("settings")}>
            调整设置
          </Button>
        </div>
      </Panel>
    </section>
  );
}

// Warnings 渲染路径风险提示，没有风险时不占位。
function Warnings({ items }: { items: string[] | null | undefined }) {
  const warnings = items ?? [];
  if (!warnings.length) return null;
  return (
    <ul className="grid gap-1 rounded-lg border border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
      {warnings.map((item) => (
        <li className="list-disc" key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

// StatusCard 渲染运行状态说明和可选操作。
function StatusCard({ title, text, success = false, children }: { title: string; text: string; success?: boolean; children?: React.ReactNode }) {
  return (
    <div className={success ? "grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4" : "grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4"}>
      <strong className="text-slate-950">{title}</strong>
      <span className="text-sm text-slate-600">{text}</span>
      {children}
    </div>
  );
}
