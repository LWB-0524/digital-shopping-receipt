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

// 先看用户有没有手动合并过，没有再用自动规则
export function canonicalStore(store: string, aliases?: Map<string, string>): string {
  return aliases?.get(store) ?? normalizeStore(store);
}

// 店名里的品牌词：第一个英文单词（跳过 supermarket 这类通用词），用来提示"可能是同一家"
const GENERIC_WORDS = new Set(["the", "new", "nz", "supermarket", "store", "shop", "market", "mart"]);

export function brandKey(store: string): string | null {
  const words = store.toLowerCase().match(/[a-z][a-z'’&]+/g) ?? [];
  const word = words.find((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
  return word ?? null;
}

// 找出品牌词相同、但还没合并成一家的店铺
export function suggestStoreMerges(stores: { store: string }[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const s of stores) {
    const key = brandKey(s.store);
    if (key) groups.set(key, [...(groups.get(key) ?? []), s.store]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
