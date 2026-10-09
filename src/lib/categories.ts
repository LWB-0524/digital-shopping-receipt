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
  // 外出就餐小票里的菜品、饮品，以及附加费、小费
  { group: "外出就餐", categories: ["正餐", "快餐小吃", "咖啡茶饮", "甜品", "酒水", "服务费小费"] },
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

// 小票类型：超市购物 / 外出就餐
export const RECEIPT_KINDS = [
  { kind: "grocery", label: "超市购物", short: "超市" },
  { kind: "dining", label: "外出就餐", short: "餐饮" },
] as const;

export type ReceiptKind = (typeof RECEIPT_KINDS)[number]["kind"];

export function isReceiptKind(value: unknown): value is ReceiptKind {
  return value === "grocery" || value === "dining";
}

export function kindLabel(kind: string, short = false): string {
  const found = RECEIPT_KINDS.find((k) => k.kind === kind);
  return found ? (short ? found.short : found.label) : "超市购物";
}

export const DINING_GROUP = "外出就餐";

export function isDiningCategory(category: string): boolean {
  return groupOf(category) === DINING_GROUP;
}
