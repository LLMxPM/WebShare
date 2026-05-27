// 文件功能描述：渲染管理后台左侧全局导航、账号信息和退出入口。
import { FolderKanban, LogOut, MonitorCog, Network, Settings, Users } from "lucide-react";
import type { ActiveView } from "../../appTypes";
import type { ConsoleController } from "../../hooks/useConsoleState";
import { Button } from "../../ui";
import { classNames, roleLabel } from "../../utils/format";

const brandLogoURL = `${import.meta.env.BASE_URL}icons/webshare-logo.svg`;

// GlobalNav 展示全局模块切换和当前账号操作。
export function GlobalNav({ app }: { app: ConsoleController }) {
  const { state } = app;
  const user = state.me!;
  const items: Array<{ key: ActiveView; label: string; count: string | number; icon: typeof FolderKanban }> = [
    { key: "projects", label: "项目", count: state.projects.length, icon: FolderKanban },
  ];
  if (user.role === "admin") {
    items.push({ key: "share", label: "分享地址", count: "IP", icon: Network }, { key: "users", label: "用户", count: state.users.length, icon: Users });
  }

  return (
    <aside className="grid min-h-0 border-b border-slate-200 bg-white p-4 lg:min-h-screen lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:border-b-0 lg:border-r">
      <div className="mb-4">
        <img className="w-40" src={brandLogoURL} alt="WebShare" />
      </div>
      <nav className="grid content-start gap-2">
        {items.map((item) => (
          <NavButton active={state.activeView === item.key} count={item.count} icon={item.icon} key={item.key} label={item.label} onClick={() => void app.setView(item.key)} />
        ))}
      </nav>
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
        <div className="min-w-0">
          <strong className="block truncate text-sm text-slate-950">{user.username}</strong>
          <span className="block break-words text-xs text-slate-500">
            {roleLabel(user.role)}
            {user.email ? ` · ${user.email}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Settings} type="button" onClick={app.openAccountModal}>
            账号设置
          </Button>
          <Button icon={LogOut} type="button" onClick={() => void app.logout()} disabled={app.isPending("action:logout")}>
            退出
          </Button>
        </div>
      </div>
    </aside>
  );
}

// NavButton 渲染单个全局导航项，并展示数量徽标。
function NavButton({ active, label, count, icon: Icon, onClick }: { active: boolean; label: string; count: string | number; icon: typeof MonitorCog; onClick: () => void }) {
  return (
    <button
      className={classNames(
        "flex min-h-10 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition",
        active ? "border-teal-200 bg-teal-50 text-teal-800" : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50",
      )}
      type="button"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-2">
        <Icon size={16} />
        {label}
      </span>
      <b className="min-w-6 rounded-full bg-slate-100 px-2 text-center text-xs font-extrabold text-slate-600">{count}</b>
    </button>
  );
}
