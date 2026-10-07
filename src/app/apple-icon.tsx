import { ImageResponse } from "next/og";
import { IconArt } from "@/components/IconArt";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// 添加到 iPhone 主屏幕时显示的图标
export default function AppleIcon() {
  return new ImageResponse(<IconArt />, size);
}
