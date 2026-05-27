// 文件功能描述：渲染 WebShare 登录页并提交账号密码。
import { FormEvent } from "react";
import { LogIn } from "lucide-react";
import type { ConsoleController } from "../hooks/useConsoleState";
import { Button, inputClass, labelClass } from "../ui";

const brandLogoURL = `${import.meta.env.BASE_URL}icons/webshare-logo.svg`;
const brandIconURL = `${import.meta.env.BASE_URL}icons/webshare-icon.svg`;

// LoginPage 展示内部管理控制台登录表单。
export function LoginPage({ app }: { app: ConsoleController }) {
  const pending = app.isPending("form:login");

  // handleSubmit 读取用户名和密码，并交给集中状态层完成登录和初始化。
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void app.login(String(data.get("username")), String(data.get("password")));
  }

  return (
    <main className="grid min-h-screen items-center justify-items-start overflow-x-hidden bg-[linear-gradient(135deg,rgba(12,110,245,0.10),rgba(20,184,166,0.08)_38%,rgba(248,250,252,0)_68%)] bg-slate-50 p-5 sm:place-items-center sm:p-8">
      <section className="grid w-full max-w-[340px] min-w-0 grid-cols-1 items-stretch gap-4 sm:max-w-md md:max-w-2xl lg:max-w-5xl lg:grid-cols-[minmax(320px,1fr)_minmax(360px,420px)]" aria-label="WebShare 登录">
        <div className="relative hidden min-h-56 min-w-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl md:grid lg:min-h-[470px]" aria-hidden="true">
          <div className="absolute inset-6 rounded-lg border border-slate-200 bg-[linear-gradient(rgba(12,110,245,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.08)_1px,transparent_1px)] bg-[length:32px_32px]" />
          <div className="absolute inset-x-12 bottom-12 grid gap-3">
            <span className="h-3 w-7/12 rounded-full bg-gradient-to-r from-blue-100 to-teal-100" />
            <span className="h-3 w-9/12 rounded-full bg-gradient-to-r from-blue-100 to-teal-100" />
            <span className="h-3 w-5/12 rounded-full bg-gradient-to-r from-blue-100 to-teal-100" />
          </div>
          <img className="relative w-[min(330px,72%)] drop-shadow-2xl" src={brandIconURL} alt="" />
        </div>
        <form className="grid min-w-0 content-center gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-xl sm:p-9 md:min-h-[470px]" onSubmit={handleSubmit}>
          <div className="grid gap-3">
            <img className="w-[min(260px,100%)]" src={brandLogoURL} alt="WebShare" />
            <div>
              <h1 className="text-2xl font-bold text-slate-950">登录 WebShare</h1>
              <p className="mt-1 text-sm text-slate-500">内部管理控制台</p>
            </div>
          </div>
          <div className="grid gap-3">
            <label className={labelClass + " min-w-0"}>
              用户名 / 邮箱
              <input className="min-h-12 w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-3 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/15" name="username" autoComplete="username" required autoFocus />
            </label>
            <label className={labelClass + " min-w-0"}>
              密码
              <input className={inputClass + " min-h-12 rounded-lg bg-slate-50 focus:bg-white"} name="password" type="password" autoComplete="current-password" required />
            </label>
          </div>
          <Button className="min-h-12 w-full bg-blue-600 hover:bg-blue-700 hover:border-blue-700" variant="primary" icon={LogIn} type="submit" disabled={pending}>
            {pending ? "登录中" : "登录"}
          </Button>
        </form>
      </section>
    </main>
  );
}
