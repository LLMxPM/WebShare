// 文件功能描述：渲染当前用户自助修改邮箱和密码的账号设置弹窗。
import { FormEvent } from "react";
import { KeyRound, Mail } from "lucide-react";
import type { ConsoleController } from "../../hooks/useConsoleState";
import { Button, Modal, inputClass, labelClass } from "../../ui";
import { classNames } from "../../utils/format";

// AccountModal 提供邮箱保存和密码修改两个表单。
export function AccountModal({ app }: { app: ConsoleController }) {
  const { state } = app;
  const user = state.me!;

  // submitEmail 提交当前用户邮箱更新。
  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void app.saveAccountEmail(String(data.get("email") || ""));
  }

  // submitPassword 提交当前用户密码修改。
  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void app.changeOwnPassword(String(data.get("currentPassword")), String(data.get("newPassword")));
  }

  return (
    <Modal eyebrow="账号设置" title={user.username} onClose={app.closeAccountModal}>
      <div className="flex flex-wrap gap-2">
        <TabButton active={state.accountModalFocus === "email"} icon={Mail} label="修改邮箱" onClick={() => app.setAccountFocus("email")} />
        <TabButton active={state.accountModalFocus === "password"} icon={KeyRound} label="修改密码" onClick={() => app.setAccountFocus("password")} />
      </div>
      {state.accountModalFocus === "password" ? (
        <form className="grid gap-4 border-t border-slate-100 pt-4" onSubmit={submitPassword}>
          <label className={labelClass}>
            当前密码
            <input className={inputClass} name="currentPassword" type="password" autoComplete="current-password" required autoFocus />
          </label>
          <label className={labelClass}>
            新密码
            <input className={inputClass} name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={app.closeAccountModal}>
              取消
            </Button>
            <Button variant="primary" type="submit" disabled={app.isPending("form:account-password")}>
              {app.isPending("form:account-password") ? "处理中" : "修改密码"}
            </Button>
          </div>
        </form>
      ) : (
        <form className="grid gap-4" onSubmit={submitEmail}>
          <label className={labelClass}>
            邮箱
            <input className={inputClass} name="email" type="email" defaultValue={user.email || ""} placeholder="name@example.com" autoFocus />
          </label>
          <div className="flex justify-end">
            <Button variant="primary" type="submit" disabled={app.isPending("form:account-email")}>
              {app.isPending("form:account-email") ? "处理中" : "保存邮箱"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// TabButton 渲染账号设置弹窗中的分段切换按钮。
function TabButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: typeof Mail; onClick: () => void }) {
  return (
    <button
      className={classNames("inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium", active ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700")}
      type="button"
      onClick={onClick}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
