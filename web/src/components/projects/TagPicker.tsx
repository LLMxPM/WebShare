// 文件功能描述：提供项目创建和设置表单中复用的已有标签选择控件。
import { parseTagsInput, tagsInputValue } from "../../utils/format";

// TagPicker 根据输入框文本切换已有标签，并同步逗号分隔值。
export function TagPicker({ tags, value, onChange }: { tags: string[]; value: string; onChange: (value: string) => void }) {
  if (!tags.length) return null;
  const selected = new Set(parseTagsInput(value).map((tag) => tag.toLowerCase()));

  // toggleTag 在当前标签输入值中增加或移除指定标签。
  function toggleTag(tag: string) {
    const current = parseTagsInput(value);
    const key = tag.toLowerCase();
    const next = current.some((item) => item.toLowerCase() === key) ? current.filter((item) => item.toLowerCase() !== key) : [...current, tag];
    onChange(tagsInputValue(next));
  }

  return (
    <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
      <span className="text-xs font-extrabold text-slate-500">已有标签</span>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const active = selected.has(tag.toLowerCase());
          return (
            <button className={active ? "min-h-7 rounded-full border border-teal-200 bg-teal-50 px-2.5 text-xs font-extrabold text-teal-700" : "min-h-7 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-extrabold text-slate-600"} key={tag} type="button" onClick={() => toggleTag(tag)}>
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
