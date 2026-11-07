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
  // 没有购物小票的支出：交通、订阅、账单等
  { group: "交通出行", categories: ["公共交通", "打车", "加油充电", "停车", "车辆保养"] },
  { group: "生活服务", categories: ["订阅会员", "话费网费", "水电燃气", "医疗健康", "洗衣家政"] },
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

// 小票类型：超市购物 / 外出就餐 / 其他支出（交通、订阅、账单等，通常没有购物小票）
export const RECEIPT_KINDS = [
  { kind: "grocery", label: "超市购物", short: "超市" },
  { kind: "dining", label: "外出就餐", short: "餐饮" },
  { kind: "other", label: "其他支出", short: "其他支出" },
] as const;

export type ReceiptKind = (typeof RECEIPT_KINDS)[number]["kind"];

export function isReceiptKind(value: unknown): value is ReceiptKind {
  return value === "grocery" || value === "dining" || value === "other";
}

export function kindLabel(kind: string, short = false): string {
  const found = RECEIPT_KINDS.find((k) => k.kind === kind);
  return found ? (short ? found.short : found.label) : "超市购物";
}

// 每类小票主要使用的大类；"其他"大类任何小票都能用
const KIND_GROUPS: Record<ReceiptKind, readonly string[]> = {
  grocery: ["食品", "零食饮料", "日用百货"],
  dining: ["外出就餐"],
  other: ["交通出行", "生活服务"],
};

// 这个品类是否属于这类小票（用于记住的品类只在同一类小票里套用）
export function categoryFitsKind(category: string, kind: ReceiptKind): boolean {
  const group = groupOf(category);
  return group === "其他" || KIND_GROUPS[kind].includes(group);
}

// 手动添加一行时的默认品类
export function defaultCategory(kind: ReceiptKind): string {
  return kind === "dining" ? "正餐" : kind === "other" ? "订阅会员" : "其他";
}
