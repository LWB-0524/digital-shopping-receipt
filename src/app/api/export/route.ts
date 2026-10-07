import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { groupOf } from "@/lib/categories";
import { getDb } from "@/lib/db";

export const maxDuration = 60;

// 导出全部小票和商品明细为 Excel（不含照片）
export async function GET() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const db = await getDb();

  const [receipts, items] = await Promise.all([
    db.execute({
      sql: `SELECT r.id, r.store, r.purchased_at, r.total, r.discount, r.note,
              (SELECT COUNT(*) FROM receipt_items i WHERE i.receipt_id = r.id) AS item_count
            FROM receipts r WHERE r.user_id = ? ORDER BY r.purchased_at, r.id`,
      args: [session.userId],
    }),
    db.execute({
      sql: `SELECT r.id AS receipt_id, r.store, r.purchased_at, i.name, i.generic_name, i.category,
              i.quantity, i.unit, i.unit_price, i.amount, i.raw_name
            FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id
            WHERE i.user_id = ? ORDER BY r.purchased_at, r.id, i.position`,
      args: [session.userId],
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "小票记账";
  wb.created = new Date();

  const itemSheet = wb.addWorksheet("商品明细", { views: [{ state: "frozen", ySplit: 1 }] });
  itemSheet.columns = [
    { header: "日期", key: "date", width: 12 },
    { header: "时间", key: "time", width: 8 },
    { header: "商店", key: "store", width: 26 },
    { header: "商品", key: "name", width: 34 },
    { header: "通用名", key: "generic", width: 12 },
    { header: "大类", key: "group", width: 10 },
    { header: "品类", key: "category", width: 10 },
    { header: "数量", key: "quantity", width: 8 },
    { header: "单位", key: "unit", width: 6 },
    { header: "单价", key: "unit_price", width: 10, style: { numFmt: "0.00" } },
    { header: "金额", key: "amount", width: 10, style: { numFmt: "0.00" } },
    { header: "小票原文", key: "raw", width: 30 },
    { header: "小票编号", key: "receipt_id", width: 9 },
  ];
  for (const r of items.rows) {
    const at = String(r.purchased_at);
    itemSheet.addRow({
      date: at.slice(0, 10),
      time: at.slice(11, 16),
      store: r.store,
      name: r.name,
      generic: r.generic_name,
      group: groupOf(String(r.category)),
      category: r.category,
      quantity: Number(r.quantity),
      unit: r.unit,
      unit_price: Number(r.unit_price),
      amount: Number(r.amount),
      raw: r.raw_name,
      receipt_id: Number(r.receipt_id),
    });
  }

  const receiptSheet = wb.addWorksheet("小票", { views: [{ state: "frozen", ySplit: 1 }] });
  receiptSheet.columns = [
    { header: "小票编号", key: "id", width: 9 },
    { header: "日期", key: "date", width: 12 },
    { header: "时间", key: "time", width: 8 },
    { header: "商店", key: "store", width: 26 },
    { header: "商品数", key: "item_count", width: 8 },
    { header: "整单优惠", key: "discount", width: 10, style: { numFmt: "0.00" } },
    { header: "实付", key: "total", width: 10, style: { numFmt: "0.00" } },
    { header: "备注", key: "note", width: 30 },
  ];
  for (const r of receipts.rows) {
    const at = String(r.purchased_at);
    receiptSheet.addRow({
      id: Number(r.id),
      date: at.slice(0, 10),
      time: at.slice(11, 16),
      store: r.store,
      item_count: Number(r.item_count),
      discount: Number(r.discount),
      total: Number(r.total),
      note: r.note,
    });
  }

  for (const sheet of [itemSheet, receiptSheet]) {
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `小票记账-${today}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="receipts-${today}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
