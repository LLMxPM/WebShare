// 文件功能描述：渲染管理员创建用户、编辑用户和重置密码弹窗。
import { FormEvent } from "react";
import type { ConsoleController } from "../../hooks/useConsoleState";
import { Button, Modal, inputClass, labelClass, selectClass } from "../../ui";

// UserModal 根据弹窗模式展示对应用户表单。
export function UserModal({ app }: { app: ConsoleController }) {
  const modal = app.state.userModal!;
  const user = modal.userId ? app.state.users.find((item) => item.id === modal.userId) || null : null;
  if (modal.mode !== "create" && !user) return null;

  if (modal.mode === "reset" && user) return <ResetPasswordModal app={app} userId={user.id} username={user.username} />;
  return <UserEditorModal app={app} editing={modal.mode === "edit"} user={user} />;
}

// ResetPasswordModal 提交指定用户的新密码。
function ResetPasswordModal({ app, userId, username }: { app: ConsoleController; userId: number; username: string }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void app.resetUserPassword(userId, String(data.get("password")));
  }

  return (
    <Modal eyebrow="重置密码" title={username} onClose={app.closeUserModal}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className={labelClass}>
          新密码
          <input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={app.closeUserModal}>取消</Button>
          <Button variant="primary" type="submit" disabled={app.isPending(`form:user-reset:${userId}`)}>
            {app.isPending(`form:user-reset:${userId}`) ? "处理中" : "保存密码"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// UserEditorModal 创建或编辑用户基础信息。
function UserEditorModal({ app, editing, user }: { app: ConsoleController; editing: boolean; user: ConsoleController["state"]["users"][number] | null }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (editing && user) {
      const disabled = user.id === app.state.me?.id ? false : Boolean(data.get("disabled"));
      void app.saveUser(user.id, { username: String(data.get("username")), email: String(data.get("email")), role: String(data.get("role")), disabled });
      return;
    }
    void app.createUser({ username: String(data.get("username")), email: String(data.get("email")), password: String(data.get("password")), role: String(data.get("role")) });
  }

  const pendingKey = editing && user ? `form:user-edit:${user.id}` : "form:user-create";

  return (
    <Modal eyebrow={editing ? "编辑用户" : "创建用户"} title={editing && user ? user.username : "新增账号"} onClose={app.closeUserModal}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className={labelClass}>
          用户名
          <input className={inputClass} name="username" defaultValue={user?.username || ""} minLength={3} required autoFocus />
        </label>
        <label className={labelClass}>
          邮箱
          <input className={inputClass} name="email" type="email" defaultValue={user?.email || ""} placeholder="name@example.com" required={!editing} />
        </label>
        {!editing ? (
          <label className={labelClass}>
            初始密码
            <input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
        ) : null}
        <label className={labelClass}>
          角色
          <select className={selectClass} name="role" defaultValue={user?.role || "user"}>
            <option value="user">用户</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        {editing ? (
          <label className="flex w-fit cursor-pointer select-none items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <input className="h-4 w-4 accent-teal-700" name="disabled" type="checkbox" defaultChecked={user?.disabled} disabled={user?.id === app.state.me?.id} />
            禁用账号
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={app.closeUserModal}>取消</Button>
          <Button variant="primary" type="submit" disabled={app.isPending(pendingKey)}>
            {app.isPending(pendingKey) ? "处理中" : editing ? "保存用户" : "创建用户"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
