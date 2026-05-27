// 文件功能描述：组合项目工作区顶部概览、标签页和当前标签内容。
import type { ConsoleController } from "../../hooks/useConsoleState";
import { EmptyInline } from "../../ui";
import { ProjectHero } from "./ProjectHero";
import { ProjectTabs } from "./ProjectTabs";
import { OverviewTab } from "./OverviewTab";
import { PublishTab } from "./PublishTab";
import { FilesTab } from "./FilesTab";
import { VersionsTab } from "./VersionsTab";
import { SettingsTab } from "./SettingsTab";

// ProjectWorkspace 根据当前选中项目渲染右侧工作区。
export function ProjectWorkspace({ app }: { app: ConsoleController }) {
  const project = app.selectedProject;
  if (!project) {
    return (
      <section className="grid h-full min-h-0 place-items-center rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="grid gap-2">
          <h2 className="text-xl font-bold text-slate-950">还没有项目</h2>
          <p className="text-sm text-slate-500">在中栏创建项目后，上传 ZIP、文件夹或 HTML 即可获得访问地址。</p>
        </div>
      </section>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <ProjectHero app={app} project={project} />
      <ProjectTabs app={app} project={project} />
      <div className="min-h-0 overflow-auto pr-1">
        {app.state.activeProjectTab === "overview" ? <OverviewTab app={app} project={project} /> : null}
        {app.state.activeProjectTab === "publish" ? <PublishTab app={app} project={project} /> : null}
        {app.state.activeProjectTab === "files" ? <FilesTab app={app} project={project} /> : null}
        {app.state.activeProjectTab === "versions" ? <VersionsTab app={app} project={project} /> : null}
        {app.state.activeProjectTab === "settings" ? <SettingsTab app={app} project={project} /> : null}
        {!project.currentVersionId && app.state.activeProjectTab === "files" ? <EmptyInline>当前项目还没有版本，发布后才能管理文件。</EmptyInline> : null}
      </div>
    </div>
  );
}
