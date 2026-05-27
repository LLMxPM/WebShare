// 文件功能描述：渲染项目列表栏、搜索、分享状态筛选和标签筛选。
import { Plus, Search, X } from "lucide-react";
import type { ShareFilter } from "../../appTypes";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { Project } from "../../types";
import { Button, Pill, TagList, inputClass, selectClass } from "../../ui";
import { accessModeLabel, activeStateLabel, classNames, shareStateLabel } from "../../utils/format";

// ProjectColumn 展示当前用户可见项目并承载列表筛选。
export function ProjectColumn({ app }: { app: ConsoleController }) {
  const { state, filteredProjects, availableProjectTags } = app;

  return (
    <aside className="grid min-h-0 gap-3 border-b border-slate-200 bg-white p-3 lg:h-dvh lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:border-b-0 lg:border-r lg:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">项目</h2>
          <span className="text-xs text-slate-500">
            {filteredProjects.length} / {state.projects.length}
          </span>
        </div>
        <Button variant="primary" icon={Plus} type="button" onClick={app.openCreateModal}>
          新建
        </Button>
      </div>
      <div className="grid gap-2">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(140px,1fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(140px,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input className={inputClass + " pl-9"} value={state.projectSearch} onChange={(event) => app.setProjectSearch(event.target.value)} placeholder="搜索项目名称、标识或标签" />
          </div>
          <select className={selectClass} value={state.projectShareFilter} onChange={(event) => app.setShareFilter(event.target.value as ShareFilter)}>
            <option value="all">全部状态</option>
            <option value="public">公开</option>
            <option value="share">密钥分享</option>
            <option value="unshared">不分享</option>
          </select>
        </div>
        {availableProjectTags.length ? (
          <div className="flex flex-wrap gap-1.5" aria-label="项目标签筛选">
            {availableProjectTags.map((tag) => {
              const active = state.projectTagFilters.some((item) => item.toLowerCase() === tag.toLowerCase());
              return (
                <button
                  className={classNames("min-h-7 rounded-full border px-2.5 text-xs font-extrabold", active ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-slate-50 text-slate-600")}
                  key={tag}
                  type="button"
                  onClick={() => app.toggleProjectTagFilter(tag)}
                >
                  {tag}
                </button>
              );
            })}
            {state.projectTagFilters.length ? (
              <button className="inline-flex min-h-7 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 text-xs font-extrabold text-red-700" type="button" onClick={app.clearProjectTagFilters}>
                <X size={13} />
                清除
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid content-start gap-2 overflow-auto pr-0.5">
        {filteredProjects.length ? filteredProjects.map((project) => <ProjectItem app={app} key={project.id} project={project} />) : <p className="text-sm text-slate-500">没有匹配项目</p>}
      </div>
    </aside>
  );
}

// ProjectItem 渲染单个项目列表项和简要状态。
function ProjectItem({ app, project }: { app: ConsoleController; project: Project }) {
  const active = project.id === app.state.selectedId;
  const shareTone = project.shareState === "public" ? "green" : project.shareState === "share" ? "violet" : "amber";
  return (
    <button
      className={classNames(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border p-3 text-left transition",
        active ? "border-teal-600 bg-teal-50 shadow-[inset_3px_0_0_#0f766e]" : "border-slate-200 bg-white hover:border-teal-300",
      )}
      style={{ gridTemplateAreas: '"name tags" "meta meta" "pills pills"' }}
      type="button"
      onClick={() => void app.selectProject(project.id)}
    >
      <span className="min-w-0 truncate font-bold text-slate-950 [grid-area:name]">{project.name}</span>
      <div className="max-w-40 [grid-area:tags]">
        <TagList tags={project.tags} compact />
      </div>
      <span className="flex min-w-0 justify-between gap-2 text-xs text-slate-500 [grid-area:meta]">
        <b className="min-w-0 truncate">{project.slug}</b>
        <em className="shrink-0 not-italic">{accessModeLabel(project.accessMode)}</em>
      </span>
      <span className="flex flex-wrap gap-1.5 [grid-area:pills]">
        <Pill tone={project.active ? "green" : "red"}>{activeStateLabel(project.active)}</Pill>
        <Pill tone={shareTone}>{shareStateLabel(project.shareState)}</Pill>
        <Pill>{project.currentVersionId ? "已发布" : "未发布"}</Pill>
      </span>
    </button>
  );
}
