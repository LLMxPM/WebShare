// 文件功能描述：渲染项目顶部状态、访问地址、快捷操作和概要字段。
import { Copy, Download, ExternalLink, KeyRound, Play, Power, Upload } from "lucide-react";
import { api } from "../../api";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { Project } from "../../types";
import { Button, LinkButton, Pill, TagList } from "../../ui";
import { accessModeLabel, activeStateLabel, shareStateLabel } from "../../utils/format";

// ProjectHero 展示项目核心信息和最常用操作。
export function ProjectHero({ app, project }: { app: ConsoleController; project: Project }) {
  const shareTone = project.shareState === "public" ? "green" : project.shareState === "share" ? "violet" : "amber";
  return (
    <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2">
          <Pill tone={project.active ? "green" : "red"}>{activeStateLabel(project.active)}</Pill>
          <Pill>{accessModeLabel(project.accessMode)}</Pill>
          <Pill tone={shareTone}>{shareStateLabel(project.shareState)}</Pill>
          <Pill>{project.spaEnabled ? "SPA fallback" : "普通静态"}</Pill>
        </div>
        <h1 className="break-words text-2xl font-bold text-slate-950">{project.name}</h1>
        <div className="mt-1 break-words font-mono text-sm text-slate-500">{project.slug}</div>
        <div className="mt-3">
          <TagList tags={project.tags} />
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2 xl:justify-end">
        <Button variant="primary" icon={Copy} type="button" onClick={() => void app.copyAccessLink(project.accessUrl)} disabled={!project.active || app.isPending(`copy:${project.accessUrl}`)}>
          复制地址
        </Button>
        {project.active ? (
          <LinkButton icon={ExternalLink} href={project.accessUrl} target="_blank" rel="noreferrer">
            打开项目
          </LinkButton>
        ) : (
          <Button type="button" disabled>
            打开项目
          </Button>
        )}
        {project.currentVersionId ? (
          <LinkButton icon={Download} href={api.packageExeUrl(project.id)}>
            下载 EXE
          </LinkButton>
        ) : (
          <Button type="button" disabled>
            下载 EXE
          </Button>
        )}
        <Button icon={Upload} type="button" onClick={() => app.setProjectTab("publish")}>
          发布
        </Button>
        <Button icon={KeyRound} type="button" onClick={() => void app.shareKey()} disabled={app.isPending("action:share-key")}>
          分享密钥
        </Button>
        {project.active ? (
          <Button variant="danger" icon={Power} type="button" onClick={() => void app.deactivateProject()} disabled={app.isPending("action:deactivate-project")}>
            停用
          </Button>
        ) : (
          <Button variant="primary" icon={Play} type="button" onClick={() => void app.activateProject()} disabled={app.isPending("action:activate-project")}>
            激活
          </Button>
        )}
      </div>
      <AccessStrip label="访问地址" active={project.active} value={project.accessUrl} />
      {app.state.shareUrl ? <AccessStrip label="密钥链接" value={app.state.shareUrl} tone="violet" /> : null}
      <div className="grid gap-2 md:grid-cols-2 xl:col-span-2 xl:grid-cols-4">
        <SummaryItem label="BaseURL" value={project.detectedBaseUrl || "未识别"} />
        <SummaryItem label="入口文件" value={project.entryFile || "index.html"} />
        <SummaryItem label="挂载路径" value={project.mountPath || "-"} />
        <SummaryItem label="端口" value={project.port ? String(project.port) : "-"} />
        <SummaryItem label="运行状态" value={activeStateLabel(project.active)} />
      </div>
    </section>
  );
}

// AccessStrip 渲染项目访问地址或密钥链接。
function AccessStrip({ label, value, active = false, tone = "green" }: { label: string; value: string; active?: boolean; tone?: "green" | "violet" }) {
  return (
    <div className={tone === "violet" ? "grid gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 md:grid-cols-[84px_minmax(0,1fr)] xl:col-span-2" : "grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 md:grid-cols-[84px_minmax(0,1fr)] xl:col-span-2"}>
      <span className="text-sm font-bold text-slate-600">{label}</span>
      {active ? (
        <a className="min-w-0 break-words text-sm font-medium text-teal-700" href={value} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <code className="min-w-0 break-words text-sm text-slate-700">{value}</code>
      )}
    </div>
  );
}

// SummaryItem 渲染项目概要字段。
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <span className="text-xs font-extrabold text-slate-500">{label}</span>
      <strong className="min-w-0 break-words text-sm text-slate-950">{value}</strong>
    </div>
  );
}
