// 品类分两级：大类用于粗筛（比如"食品"），小类是每个商品实际保存的分类。
// 识别时大模型只能从 CATEGORIES 里选，所以修改这里就能调整分类体系。
export const CATEGORY_GROUPS = [
  {
    group: "食品",
    categories: [
      "蔬菜水果",
      "肉禽蛋",
      "水产海鲜",
      "乳制品",
      "粮油调味",
      "速食冻品",
      "熟食烘焙",
    ],
  },
  { group: "零食饮料", categories: ["零食", "饮料", "酒类"] },
  { group: "日用百货", categories: ["日用品", "清洁用品", "个护美妆", "厨具家居"] },
  { group: "其他", categories: ["母婴", "宠物", "服饰", "其他"] },
] as const;

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]["group"];
export type Category = (typeof CATEGORY_GROUPS)[number]["categories"][number];

export const CATEGORIES: Category[] = CATEGORY_GROUPS.flatMap((g) => [...g.categories]);
export const GROUPS: CategoryGroup[] = CATEGORY_GROUPS.map((g) => g.group);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as string[]).includes(value);
}

export function groupOf(category: string): CategoryGroup {
  const found = CATEGORY_GROUPS.find((g) => (g.categories as readonly string[]).includes(category));
  return found ? found.group : "其他";
}

export function categoriesInGroup(group: string): string[] {
  const found = CATEGORY_GROUPS.find((g) => g.group === group);
  return found ? [...found.categories] : [];
}
