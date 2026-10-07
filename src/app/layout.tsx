import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小票记账",
  description: "拍照识别购物小票，按日期和品类整理消费记录",
  appleWebApp: { capable: true, title: "小票记账", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f6f3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
