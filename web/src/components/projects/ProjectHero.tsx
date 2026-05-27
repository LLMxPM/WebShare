// 文件功能描述：渲染项目顶部状态、访问地址、快捷操作、二维码和概要字段。
import { useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Copy, Download, KeyRound, Play, Power, QrCode, Upload } from "lucide-react";
import { api } from "../../api";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { Project } from "../../types";
import { Button, LinkButton, Modal, TagList } from "../../ui";
import { accessModeLabel, activeStateLabel, shareStateLabel } from "../../utils/format";

// ProjectHero 展示项目核心信息和最常用操作。
export function ProjectHero({ app, project }: { app: ConsoleController; project: Project }) {
  const shareTone = project.shareState === "public" ? "green" : project.shareState === "share" ? "violet" : "amber";
  const encrypted = project.shareState === "share";
  const [qrModal, setQrModal] = useState<{ title: string; value: string; dataUrl: string } | null>(null);

  // openQrModal 将指定地址转换为二维码 data URL 后展示弹窗。
  async function openQrModal(title: string, value: string) {
    const dataUrl = await QRCode.toDataURL(value, { margin: 2, width: 280, errorCorrectionLevel: "M" });
    setQrModal({ title, value, dataUrl });
  }

  return (
    <section className="relative grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="min-w-0 break-words text-2xl font-bold leading-tight text-slate-950">{project.name}</h1>
          <code className="min-w-0 break-words rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{project.slug}</code>
          <TagList tags={project.tags} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge tone={project.active ? "green" : "red"}>{activeStateLabel(project.active)}</StatusBadge>
          <StatusBadge tone={shareTone}>{shareStateLabel(project.shareState)}</StatusBadge>
          <StatusBadge>{accessModeLabel(project.accessMode)}</StatusBadge>
          <StatusBadge>{project.spaEnabled ? "SPA fallback" : "普通静态"}</StatusBadge>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-1.5 xl:justify-end">
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
          更新版本
        </Button>
        <Button
          icon={KeyRound}
          type="button"
          onClick={() => (encrypted ? void app.disableShareKey() : void app.shareKey())}
          disabled={app.isPending("action:share-key") || app.isPending("action:disable-share-key")}
        >
          {encrypted ? "取消加密" : "加密"}
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
      <AccessStrip app={app} encrypted={encrypted} label="访问地址" active={project.active} value={project.accessUrl} tone={encrypted ? "violet" : "green"} onQr={() => void openQrModal("访问地址二维码", project.accessUrl)} />
      <div className="grid gap-2 md:grid-cols-2 xl:col-span-2 xl:grid-cols-5">
        <SummaryItem label="BaseURL" value={project.detectedBaseUrl || "未识别"} />
        <SummaryItem label="入口文件" value={project.entryFile || "index.html"} />
        <SummaryItem label="挂载路径" value={project.mountPath || "-"} />
        <SummaryItem label="端口" value={project.port ? String(project.port) : "-"} />
        <SummaryItem label="运行状态" value={activeStateLabel(project.active)} />
      </div>
      {qrModal ? <QrModal dataUrl={qrModal.dataUrl} title={qrModal.title} value={qrModal.value} onClose={() => setQrModal(null)} /> : null}
    </section>
  );
}

// StatusBadge 渲染项目详情头部状态，使用矩形样式与项目标签区分。
function StatusBadge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "red" | "violet" | "amber" }) {
  const toneClass = {
    slate: "border-slate-300 bg-white text-slate-700 shadow-slate-200/60",
    green: "border-emerald-300 bg-white text-emerald-700 shadow-emerald-100",
    red: "border-red-300 bg-white text-red-700 shadow-red-100",
    violet: "border-violet-300 bg-white text-violet-700 shadow-violet-100",
    amber: "border-amber-300 bg-white text-amber-700 shadow-amber-100",
  }[tone];
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-black shadow-sm ${toneClass}`}>{children}</span>;
}

// AccessStrip 渲染项目访问地址或密钥链接。
function AccessStrip({
  app,
  label,
  value,
  active = false,
  tone = "green",
  encrypted,
  onQr,
}: {
  app: ConsoleController;
  label: string;
  value: string;
  active?: boolean;
  tone?: "green" | "violet";
  encrypted: boolean;
  onQr: () => void;
}) {
  const stripClass =
    tone === "violet"
      ? "grid items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 md:grid-cols-[84px_minmax(0,1fr)_auto] xl:col-span-2"
      : "grid items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 md:grid-cols-[84px_minmax(0,1fr)_auto] xl:col-span-2";
  const linkClass = tone === "violet" ? "min-w-0 break-words text-sm font-medium text-violet-700" : "min-w-0 break-words text-sm font-medium text-teal-700";

  return (
    <div className={stripClass}>
      <span className="text-sm font-bold text-slate-600">{label}</span>
      {active ? (
        <a className={linkClass} href={value} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <code className="min-w-0 break-words text-sm text-slate-700">{value}</code>
      )}
      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
        {encrypted ? (
          <>
            <div className="inline-flex min-h-8 items-center rounded-md border border-violet-200 bg-white px-2.5 py-1 text-xs font-black text-violet-700">
              密钥：{app.state.shareKey || "重新加密后展示"}
            </div>
            <Button className="min-h-8 px-2.5 py-1 text-xs" icon={Copy} type="button" onClick={() => void app.copyAccessLink(value)} disabled={!value || app.isPending(`copy:${value}`)}>
              复制无密钥
            </Button>
            <Button className="min-h-8 px-2.5 py-1 text-xs" icon={KeyRound} type="button" onClick={() => void app.copyShareKeyLink()} disabled={!value || app.isPending(`copy:share-key:${app.state.selectedId || 0}`)}>
              复制带密钥
            </Button>
          </>
        ) : (
          <Button className="min-h-8 px-2.5 py-1 text-xs" icon={Copy} type="button" onClick={() => void app.copyAccessLink(value)} disabled={!value || app.isPending(`copy:${value}`)}>
            复制
          </Button>
        )}
        <Button className="min-h-8 px-2.5 py-1 text-xs" icon={QrCode} type="button" onClick={onQr} disabled={!value}>
          二维码
        </Button>
      </div>
    </div>
  );
}

// QrModal 展示指定地址转换后的二维码图片和原始地址。
function QrModal({ title, value, dataUrl, onClose }: { title: string; value: string; dataUrl: string; onClose: () => void }) {
  return (
    <Modal eyebrow="二维码" title={title} onClose={onClose}>
      <div className="grid justify-items-center gap-4">
        <img className="h-72 w-72 rounded-lg border border-slate-200 bg-white p-3" src={dataUrl} alt={`${title}：${value}`} />
        <code className="w-full rounded-lg bg-slate-50 px-3 py-2 text-center text-sm text-slate-700 break-anywhere">{value}</code>
      </div>
    </Modal>
  );
}

// SummaryItem 渲染项目概要字段。
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="text-xs font-extrabold text-slate-500">{label}</span>
      <strong className="min-w-0 break-words text-sm text-slate-950">{value}</strong>
    </div>
  );
}
