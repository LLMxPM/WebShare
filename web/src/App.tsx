// 文件功能描述：组合登录页、管理台布局、项目、用户、分享地址和全局弹窗。
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useConsoleState } from "./hooks/useConsoleState";
import { LoginPage } from "./components/LoginPage";
import { GlobalNav } from "./components/layout/GlobalNav";
import { ProjectColumn } from "./components/projects/ProjectColumn";
import { ProjectWorkspace } from "./components/projects/ProjectWorkspace";
import { AccountModal } from "./components/account/AccountModal";
import { UsersView } from "./components/users/UsersView";
import { UserModal } from "./components/users/UserModal";
import { ShareView } from "./components/share/ShareView";
import { CreateProjectModal } from "./components/projects/CreateProjectModal";

// App 根据登录态渲染登录页或三栏管理工作台。
export function App() {
  const console = useConsoleState();
  const { state } = console;

  useEffect(() => {
    void console.initialize();
  }, [console.initialize]);

  if (!state.bootstrapped) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">
        <div className="inline-flex items-center gap-2 text-sm">
          <Loader2 className="animate-spin" size={18} />
          正在加载管理后台
        </div>
      </main>
    );
  }

  if (!state.me) return <LoginPage app={console} />;

  const projectMode = state.activeView === "projects";

  return (
    <main className={projectMode ? "min-h-screen bg-slate-50 lg:grid lg:grid-cols-[220px_344px_minmax(0,1fr)]" : "min-h-screen bg-slate-50 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]"}>
      <GlobalNav app={console} />
      {projectMode ? <ProjectColumn app={console} /> : null}
      <section className="min-w-0 px-4 py-4 sm:px-5 lg:px-6">
        {state.activeView === "users" ? <UsersView app={console} /> : null}
        {state.activeView === "share" ? <ShareView app={console} /> : null}
        {state.activeView === "projects" ? <ProjectWorkspace app={console} /> : null}
      </section>
      {state.createModalOpen && projectMode ? <CreateProjectModal app={console} /> : null}
      {state.accountModalOpen ? <AccountModal app={console} /> : null}
      {state.userModal && state.activeView === "users" ? <UserModal app={console} /> : null}
    </main>
  );
}
