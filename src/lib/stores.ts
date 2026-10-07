// 同一家店在不同小票上的写法可能略有不同，例如
// "PAK'nSAVE Wairau" 和 "PAK'nSAVE Wairau（Glenfield）"。
// 去掉末尾括号里的补充说明、合并多余空格后作为"店铺"统计。只用于显示和筛选，不改动原始数据。
export function normalizeStore(store: string): string {
  const name = store
    .replace(/\s*[（(][^（）()]*[）)]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return name || store.trim() || "未命名商店";
}
