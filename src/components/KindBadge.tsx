import { kindLabel } from "@/lib/categories";

const STYLES: Record<string, string> = {
  grocery: "bg-accent-soft text-accent",
  dining: "bg-warn-soft text-warn",
  other: "bg-line text-muted",
};

// 小票类型标签
export function KindBadge({ kind }: { kind: string }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-px text-xs ${STYLES[kind] ?? STYLES.grocery}`}>{kindLabel(kind, true)}</span>
  );
}
