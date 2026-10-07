"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ReceiptEditor } from "@/components/ReceiptEditor";
import { api, localDateTime } from "@/lib/format";
import { compressImage } from "@/lib/image";
import type { ReceiptInput, RecognizeResult, UploadImage } from "@/lib/types";

const MAX_IMAGES = 4;

type Photo = UploadImage & { previewUrl: string };

export default function ScanPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState<"" | "compress" | "recognize">("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ receipt: ReceiptInput; warnings: string } | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setBusy("compress");
    try {
      const room = MAX_IMAGES - photos.length;
      const picked = [...files].slice(0, room);
      const compressed = await Promise.all(picked.map(compressImage));
      setPhotos((p) => [...p, ...compressed]);
      if (files.length > room) setError(`一张小票最多 ${MAX_IMAGES} 张照片`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function recognize() {
    setError("");
    setBusy("recognize");
    try {
      const result = await api<RecognizeResult>("/api/recognize", {
        method: "POST",
        body: JSON.stringify({
          images: photos.map(({ media_type, data }) => ({ media_type, data })),
          today: localDateTime(),
        }),
      });
      setDraft({ receipt: result, warnings: result.warnings });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function save(receipt: ReceiptInput) {
    const { id } = await api<{ id: number }>("/api/receipts", {
      method: "POST",
      body: JSON.stringify({ receipt, images: photos.map(({ media_type, data }) => ({ media_type, data })) }),
    });
    router.replace(`/receipts/${id}`);
  }

  if (draft) {
    return (
      <AppShell title="确认识别结果">
        {photos.length > 0 && <PhotoStrip photos={photos} />}
        <ReceiptEditor
          initial={draft.receipt}
          warnings={draft.warnings}
          submitLabel="保存小票"
          onSubmit={save}
          onCancel={() => setDraft(null)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="拍小票">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== ""}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/40 bg-card py-16 text-accent"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M4 8h3l2-3h6l2 3h3v11H4V8z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="text-base font-medium">{busy === "compress" ? "处理照片中…" : "拍照或从相册选择"}</span>
          <span className="text-xs text-muted">小票很长时可以分段拍，最多 {MAX_IMAGES} 张</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {photos.map((p, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-line bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- 本地预览图，不需要 next/image 优化 */}
                <img src={p.previewUrl} alt={`第 ${i + 1} 张`} className="h-48 w-full object-cover object-top" />
                <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 rounded bg-black/60 px-2 text-sm text-white"
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  disabled={busy !== ""}
                  aria-label={`删除第 ${i + 1} 张`}
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy !== ""}
                className="flex h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-sm text-muted"
              >
                + 再加一张
                <span className="mt-1 text-xs">（长小票的下一段）</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={recognize}
            disabled={busy !== ""}
            className="w-full rounded-lg bg-accent py-3 font-medium text-white disabled:opacity-60"
          >
            {busy === "recognize" ? "正在识别，大约需要 10～40 秒…" : "开始识别"}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-8 space-y-1.5 text-sm text-muted">
        <p>拍摄小技巧：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>把小票放平，在光线充足的地方拍，避免反光</li>
          <li>让小票占满画面，文字越清楚识别越准</li>
          <li>识别后可以逐项检查修改，确认无误再保存</li>
        </ul>
        <button
          type="button"
          className="pt-3 text-accent"
          onClick={() =>
            setDraft({
              receipt: { store: "", purchased_at: localDateTime(), total: 0, discount: 0, note: "", items: [] },
              warnings: "",
            })
          }
        >
          没有小票？手动记一笔
        </button>
      </div>
    </AppShell>
  );
}

function PhotoStrip({ photos }: { photos: Photo[] }) {
  const [zoom, setZoom] = useState<number | null>(null);
  return (
    <>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {photos.map((p, i) => (
          <button key={i} type="button" className="shrink-0" onClick={() => setZoom(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 本地预览图 */}
            <img src={p.previewUrl} alt={`第 ${i + 1} 张`} className="h-24 rounded-lg border border-line object-cover object-top" />
          </button>
        ))}
      </div>
      {zoom !== null && (
        <button
          type="button"
          className="fixed inset-0 z-20 overflow-y-auto bg-black/85 p-4"
          onClick={() => setZoom(null)}
          aria-label="关闭大图"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 本地预览图 */}
          <img src={photos[zoom].previewUrl} alt="小票大图" className="mx-auto w-full max-w-xl" />
        </button>
      )}
    </>
  );
}
