// 文件功能描述：渲染管理员用户管理视图、搜索框、用户表格和账号操作。
import { Edit3, KeyRound, Plus, Search, UserMinus, UserPlus } from "lucide-react";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { User } from "../../types";
import { Button, EmptyInline, Eyebrow, Panel, PanelHead, inputClass } from "../../ui";
import { classNames, formatDate, roleLabel } from "../../utils/format";

// UsersView 展示用户列表和创建用户入口。
export function UsersView({ app }: { app: ConsoleController }) {
  const { state, filteredUsers } = app;
  if (state.me?.role !== "admin") return <Panel><EmptyInline>需要管理员权限。</EmptyInline></Panel>;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <Eyebrow>用户管理</Eyebrow>
          <h1 className="text-2xl font-bold text-slate-950">账号与权限</h1>
        </div>
        <Button variant="primary" icon={Plus} type="button" onClick={() => app.openUserModal({ mode: "create" })}>
          创建用户
        </Button>
      </section>
      <Panel>
        <PanelHead title="用户列表" meta={`${filteredUsers.length} / ${state.users.length} 个账号`} />
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className={inputClass + " pl-9"} value={state.userSearch} onChange={(event) => app.setUserSearch(event.target.value)} placeholder="搜索用户名、邮箱或角色" />
        </div>
        {filteredUsers.length ? <UserTable app={app} users={filteredUsers} /> : <p className="text-sm text-slate-500">没有匹配用户</p>}
      </Panel>
    </div>
  );
}

// UserTable 渲染横向可滚动用户表格。
function UserTable({ app, users }: { app: ConsoleController; users: User[] }) {
  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-extrabold text-slate-600">
            <th className="w-16 border-b border-slate-100 px-2 py-3 text-center">序号</th>
            <th className="border-b border-slate-100 px-2 py-3">用户名</th>
            <th className="border-b border-slate-100 px-2 py-3">邮箱</th>
            <th className="border-b border-slate-100 px-2 py-3">角色</th>
            <th className="border-b border-slate-100 px-2 py-3">状态</th>
            <th className="border-b border-slate-100 px-2 py-3">创建时间</th>
            <th className="border-b border-slate-100 px-2 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <UserRow app={app} index={index} key={user.id} user={user} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// UserRow 渲染单个用户表格行。
function UserRow({ app, user, index }: { app: ConsoleController; user: User; index: number }) {
  const isCurrent = user.id === app.state.me?.id;
  const nextDisabled = !user.disabled;
  return (
    <tr className="text-slate-800">
      <td className="border-b border-slate-100 px-2 py-3 text-center">{index + 1}</td>
      <td className="border-b border-slate-100 px-2 py-3"><strong>{user.username}</strong></td>
      <td className="border-b border-slate-100 px-2 py-3">{user.email || <span className="text-slate-400">未设置</span>}</td>
      <td className="border-b border-slate-100 px-2 py-3">{roleLabel(user.role)}</td>
      <td className="border-b border-slate-100 px-2 py-3">
        <span className={classNames("inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-extrabold", user.disabled ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
          {user.disabled ? "已禁用" : "启用中"}
        </span>
      </td>
      <td className="border-b border-slate-100 px-2 py-3">{formatDate(user.createdAt)}</td>
      <td className="border-b border-slate-100 px-2 py-3">
        <div className="flex flex-wrap gap-2">
          <Button icon={Edit3} type="button" onClick={() => app.openUserModal({ mode: "edit", userId: user.id })}>编辑</Button>
          <Button icon={KeyRound} type="button" onClick={() => app.openUserModal({ mode: "reset", userId: user.id })}>重置密码</Button>
          <Button icon={user.disabled ? UserPlus : UserMinus} type="button" onClick={() => void app.toggleUser(user.id, nextDisabled)} disabled={(isCurrent && nextDisabled) || app.isPending(`user:toggle:${user.id}`)}>
            {user.disabled ? "启用" : "禁用"}
          </Button>
        </div>
      </td>
    </tr>
  );
}
