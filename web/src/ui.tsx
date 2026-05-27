// 文件功能描述：提供管理后台复用的按钮、面板、标签、弹窗和表单基础组件。
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { classNames } from "./utils/format";

export const inputClass =
  "min-h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15";
export const labelClass = "grid gap-1.5 text-xs font-bold text-slate-500";
export const selectClass = inputClass;

type ButtonVariant = "default" | "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
}

// Button 渲染统一尺寸、状态和图标规范的按钮。
export function Button({ className, variant = "default", icon: Icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={classNames(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" && "border-teal-700 bg-teal-700 text-white hover:border-teal-800 hover:bg-teal-800",
        variant === "default" && "border-slate-300 bg-white text-slate-800 hover:border-teal-600 hover:text-teal-700",
        variant === "ghost" && "border-transparent bg-transparent text-slate-700 hover:border-slate-300 hover:bg-white",
        variant === "danger" && "border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
}

// LinkButton 渲染外链或下载操作，视觉上与按钮保持一致。
export function LinkButton({ className, variant = "default", icon: Icon, children, ...props }: LinkButtonProps) {
  return (
    <a
      className={classNames(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium no-underline transition",
        variant === "primary" && "border-teal-700 bg-teal-700 text-white hover:border-teal-800 hover:bg-teal-800",
        variant === "default" && "border-slate-300 bg-white text-slate-800 hover:border-teal-600 hover:text-teal-700",
        variant === "ghost" && "border-transparent bg-transparent text-slate-700 hover:border-slate-300 hover:bg-white",
        variant === "danger" && "border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </a>
  );
}

// Panel 渲染工作区中常用的白底边框内容区。
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={classNames("grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}>{children}</section>;
}

// PanelHead 渲染面板标题、说明和右侧辅助内容。
export function PanelHead({ title, meta, children, compact = false }: { title: string; meta?: ReactNode; children?: ReactNode; compact?: boolean }) {
  return (
    <div className={classNames("flex items-start justify-between gap-3", !compact && "border-b border-slate-100 pb-3")}>
      <div className="min-w-0">
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
        {meta ? <div className="mt-1 min-w-0 break-words text-xs text-slate-500">{meta}</div> : null}
      </div>
      {children}
    </div>
  );
}

// Eyebrow 渲染模块上方的小号分组标题。
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-extrabold uppercase text-slate-500">{children}</span>;
}

// Pill 渲染项目状态、标签和轻量标记。
export function Pill({ children, tone = "slate", className }: { children: ReactNode; tone?: "slate" | "green" | "red" | "violet" | "amber"; className?: string }) {
  return (
    <span
      className={classNames(
        "inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold",
        tone === "slate" && "border-slate-200 bg-slate-50 text-slate-600",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "red" && "border-red-200 bg-red-50 text-red-700",
        tone === "violet" && "border-violet-200 bg-violet-50 text-violet-700",
        tone === "amber" && "border-amber-200 bg-amber-50 text-amber-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Modal 渲染固定遮罩弹窗，承载创建、账号和用户表单。
export function Modal({ title, eyebrow, onClose, children, wide = false }: { title: ReactNode; eyebrow: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/45 p-5" role="presentation">
      <section
        className={classNames(
          "grid max-h-[calc(100vh-40px)] w-full gap-4 overflow-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl",
          wide ? "max-w-4xl" : "max-w-xl",
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="break-words text-xl font-bold text-slate-950">{title}</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}

// EmptyInline 渲染面板内部的空状态。
export function EmptyInline({ children }: { children: ReactNode }) {
  return <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">{children}</div>;
}

// TagList 渲染项目标签，标签为空时不占位。
export function TagList({ tags, compact = false }: { tags?: string[] | null; compact?: boolean }) {
  const items = tags ?? [];
  if (!items.length) return null;
  return (
    <div className={classNames("flex min-w-0 flex-wrap gap-1.5", compact && "justify-end")}>
      {items.map((tag) => (
        <span className="max-w-40 truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-extrabold text-slate-600" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}
