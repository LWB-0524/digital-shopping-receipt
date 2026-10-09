import { kindLabel } from "@/lib/categories";

// 小票类型标签：餐饮用暖色，超市用主题绿
export function KindBadge({ kind }: { kind: string }) {
  const dining = kind === "dining";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-px text-xs ${dining ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"}`}
    >
      {kindLabel(kind, true)}
    </span>
  );
}
