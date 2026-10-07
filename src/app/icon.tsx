import { ImageResponse } from "next/og";
import { IconArt } from "@/components/IconArt";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// 浏览器标签页图标
export default function Icon() {
  return new ImageResponse(<IconArt />, size);
}
