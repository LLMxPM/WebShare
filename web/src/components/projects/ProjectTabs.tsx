// 文件功能描述：渲染项目详情标签页和删除项目入口。
import { Trash2 } from "lucide-react";
import type { ProjectTab } from "../../appTypes";
import type { ConsoleController } from "../../hooks/useConsoleState";
import type { Project } from "../../types";
import { Button } from "../../ui";
import { classNames } from "../../utils/format";

// ProjectTabs 切换概览、发布、文件、版本和设置页。
export function ProjectTabs({ app, project }: { app: ConsoleController; project: Project }) {
  const tabs: Array<[ProjectTab, string]> = [
    ["overview", "概览"],
    ["publish", "发布"],
    ["files", "文件"],
    ["versions", `版本 ${app.state.versions.length}`],
    ["settings", "设置"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
      {tabs.map(([key, label]) => (
        <button
          className={classNames("min-h-9 rounded-md border px-3 text-sm font-medium", app.state.activeProjectTab === key ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-700")}
          key={key}
          type="button"
          onClick={() => app.setProjectTab(key)}
        >
          {label}
        </button>
      ))}
      <Button className="ml-0 lg:ml-auto" variant="danger" icon={Trash2} type="button" onClick={() => void app.deleteProject()} disabled={app.isPending("action:delete-project")}>
        删除项目
      </Button>
      <span className="sr-only">{project.name}</span>
    </div>
  );
}
