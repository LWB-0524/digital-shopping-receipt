import type { UploadImage } from "./types";

// 在浏览器里把照片压缩成 JPEG：长边不超过 2000px，既保证小票文字清晰，又能控制上传体积
const MAX_EDGE = 2000;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<UploadImage & { previewUrl: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持图片处理");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    return { media_type: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1), previewUrl: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片无法读取，请换一张试试"));
    img.src = src;
  });
}
