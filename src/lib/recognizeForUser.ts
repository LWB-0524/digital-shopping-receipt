import "server-only";
import { recognizeReceipt } from "./recognize";
import { applyCategoryRules, listStores, loadStoreAliases } from "./receipts";
import type { RecognizeResult, UploadImage } from "./types";

// 识别小票，并结合这个用户的历史数据修正：沿用去过的店名、套用记住的品类和通用名
export async function recognizeForUser(userId: number, images: UploadImage[], today: string): Promise<RecognizeResult> {
  const [stores, aliases] = await Promise.all([listStores(userId, {}), loadStoreAliases(userId)]);
  const knownStores = stores
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 40)
    .map((s) => s.store);
  const result = await recognizeReceipt(
    images,
    today || new Date().toISOString().slice(0, 16).replace("T", " "),
    knownStores,
  );
  result.store = aliases.get(result.store) ?? result.store;
  result.items = await applyCategoryRules(userId, result.items, result.kind);
  return result;
}
