// 店铺名称规则：一律按小票上的原样显示，只有用户手动合并过的店才算作一家（见 store_aliases 表）。
// 下面的函数只用来给出"可能是同一家"的建议，不会自动合并。

// 去掉末尾括号里的地址/分店说明，用于判断两个写法是否只差括号部分
function baseName(store: string): string {
  return store
    .replace(/\s*[（(][^（）()]*[）)]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// 店名里的品牌词：第一个英文单词（跳过 supermarket 这类通用词）
const GENERIC_WORDS = new Set(["the", "new", "nz", "supermarket", "store", "shop", "market", "mart"]);

function brandKey(store: string): string | null {
  const words = store.toLowerCase().match(/[a-z][a-z'’&]+/g) ?? [];
  return words.find((w) => w.length >= 3 && !GENERIC_WORDS.has(w)) ?? null;
}

// 找出品牌词相同（没有英文时看去掉括号后的名称是否相同）、但还没合并成一家的店铺
export function suggestStoreMerges(stores: { store: string }[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const s of stores) {
    const key = brandKey(s.store) ?? baseName(s.store);
    if (key) groups.set(key, [...(groups.get(key) ?? []), s.store]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
