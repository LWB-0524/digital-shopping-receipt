// 前后端共用的数据结构。

export type ReceiptItemInput = {
  name: string;
  raw_name: string;
  generic_name: string; // 通用名，如"鸡蛋"，同类商品归在一起
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
};

export type ReceiptInput = {
  store: string;
  purchased_at: string; // "YYYY-MM-DD HH:MM"
  total: number;
  discount: number;
  note: string;
  items: ReceiptItemInput[];
};

export type UploadImage = { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string }; // data 为 base64

export type RecognizeResult = ReceiptInput & { is_receipt: boolean; warnings: string };

export type ReceiptSummary = {
  id: number;
  store: string;
  purchased_at: string;
  total: number;
  item_count: number;
  preview: string; // 前几个商品名，列表里展示用
};

export type ReceiptDetail = Omit<ReceiptInput, "items"> & {
  id: number;
  image_count: number;
  items: (ReceiptItemInput & { id: number })[];
};

export type ItemRow = ReceiptItemInput & {
  id: number;
  receipt_id: number;
  store: string;
  purchased_at: string;
};

export type MonthlyStats = {
  months: { month: string; total: number; receipts: number }[]; // 趋势：截至 end 的最近 12 个月
  month: string;
  total: number; // 该月实付合计（按小票金额）
  receipts: number;
  categories: { category: string; amount: number }[]; // 该月各品类金额（按商品金额，未扣整单优惠）
};
