// 文件功能描述：渲染管理员分享地址、分享网关端口和独立端口段配置。
import { FormEvent } from "react";
import { Save } from "lucide-react";
import type { ConsoleController } from "../../hooks/useConsoleState";
import { Button, EmptyInline, Eyebrow, Panel, PanelHead, inputClass, labelClass, selectClass } from "../../ui";
import { urlHost } from "../../utils/format";

// ShareView 展示分享地址和网络端口设置。
export function ShareView({ app }: { app: ConsoleController }) {
  const { state } = app;
  if (state.me?.role !== "admin") return <Panel><EmptyInline>需要管理员权限。</EmptyInline></Panel>;
  const current = state.publicHostInfo?.publicHost || "未设置";
  const network = state.networkSettings;
  const sharePort = network?.activeSharePort ?? 8081;
  const portRange = network ? `${network.activePortStart}-${network.activePortEnd}` : "12000-12999";

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <Eyebrow>分享地址</Eyebrow>
          <h1 className="text-2xl font-bold text-slate-950">访问网络配置</h1>
        </div>
        <span className="text-sm text-slate-500">只有管理员可以修改项目访问地址使用的主机和端口。</span>
      </section>
      <Panel>
        <SystemAddress app={app} />
      </Panel>
      <Panel>
        <SystemNetwork app={app} />
      </Panel>
      <Panel>
        <PanelHead title="地址生成规则" meta={`当前主机：${current}`} />
        <div className="grid gap-2">
          <InfoItem label="管理后台" value="继续使用 8080 端口，不受分享地址设置影响。" />
          <InfoItem label="路径分享" value={`项目地址会按当前主机和 ${sharePort} 分享端口生成。`} />
          <InfoItem label="独立端口" value={`端口模式项目会从 ${portRange} 中分配端口。`} />
        </div>
      </Panel>
    </div>
  );
}

// SystemAddress 渲染可检测和自定义的公开分享主机表单。
function SystemAddress({ app }: { app: ConsoleController }) {
  const info = app.state.publicHostInfo;
  const candidates = info?.candidates ?? [];
  const current = info?.publicHost ?? "";
  const activeSharePort = app.state.networkSettings?.activeSharePort ?? 8081;
  const displayHost = current || "未设置";
  const gatewayURL = current ? `${window.location.protocol}//${urlHost(current)}:${activeSharePort}/` : "未设置";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const custom = String(data.get("customHost") || "").trim();
    const selected = String(data.get("publicHost") || "").trim();
    void app.updatePublicHost(custom || selected);
  }

  return (
    <div className="grid -m-4 overflow-hidden rounded-lg md:grid-cols-[minmax(260px,0.85fr)_minmax(340px,1.15fr)]">
      <div className="grid content-start gap-4 border-b border-slate-100 bg-slate-50 p-5 md:border-b-0 md:border-r">
        <Eyebrow>当前地址</Eyebrow>
        <h3 className="text-base font-bold text-slate-950">分享网关地址</h3>
        <code className="block break-words rounded-lg border border-slate-200 bg-white p-3 font-bold text-teal-700">{gatewayURL}</code>
        <div className="grid gap-2 text-sm">
          <InfoItem label="当前主机" value={displayHost} />
          <InfoItem label="当前端口" value={`路径分享使用 ${activeSharePort}；独立端口项目使用项目自己的端口。`} />
        </div>
      </div>
      <form className="grid content-start gap-4 p-5" onSubmit={handleSubmit}>
        <div>
          <h3 className="text-base font-bold text-slate-950">修改地址</h3>
          <span className="text-sm text-slate-500">选择检测到的本机地址，或输入自定义 IP / 主机名。</span>
        </div>
        <label className={labelClass}>
          本机地址
          <select className={selectClass} name="publicHost" defaultValue={current}>
            {candidates.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          自定义地址
          <input className={inputClass} name="customHost" placeholder="例如 192.168.1.20 或 host.local" />
        </label>
        <div className="flex justify-end">
          <Button variant="primary" icon={Save} type="submit" disabled={app.isPending("form:public-host")}>
            {app.isPending("form:public-host") ? "处理中" : "保存地址"}
          </Button>
        </div>
        <div className="text-xs text-slate-500">保存后会刷新项目列表和项目访问地址。</div>
      </form>
    </div>
  );
}

// SystemNetwork 渲染重启后生效的分享网关和独立端口段配置。
function SystemNetwork({ app }: { app: ConsoleController }) {
  const network = app.state.networkSettings;
  const sharePort = network?.sharePort ?? 8081;
  const portStart = network?.portStart ?? 12000;
  const portEnd = network?.portEnd ?? 12999;
  const activeRange = network ? `${network.activePortStart}-${network.activePortEnd}` : "12000-12999";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void app.updateNetworkSettings({
      sharePort: Number(data.get("sharePort")),
      portStart: Number(data.get("portStart")),
      portEnd: Number(data.get("portEnd")),
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <PanelHead title="端口配置" meta="保存后重启软件生效。" compact>
        <span className={network?.restartRequired ? "inline-flex min-h-7 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800" : "inline-flex min-h-7 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700"}>
          {network?.restartRequired ? "待重启" : "已生效"}
        </span>
      </PanelHead>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={labelClass}>分享网关端口<input className={inputClass} name="sharePort" type="number" min="1" max="65535" defaultValue={sharePort} required /></label>
        <label className={labelClass}>独立端口起点<input className={inputClass} name="portStart" type="number" min="1" max="65535" defaultValue={portStart} required /></label>
        <label className={labelClass}>独立端口终点<input className={inputClass} name="portEnd" type="number" min="1" max="65535" defaultValue={portEnd} required /></label>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">当前运行：分享网关 {network?.activeSharePort ?? 8081}，独立端口 {activeRange}</div>
      <div className="flex justify-end">
        <Button variant="primary" icon={Save} type="submit" disabled={app.isPending("form:network-settings")}>
          {app.isPending("form:network-settings") ? "处理中" : "保存端口配置"}
        </Button>
      </div>
    </form>
  );
}

// InfoItem 渲染说明列表中的一项。
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
      <strong className="text-slate-950">{label}</strong>
      <span className="min-w-0 break-words text-slate-600">{value}</span>
    </div>
  );
}
