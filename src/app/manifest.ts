import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "小票记账",
    short_name: "小票记账",
    description: "拍照识别购物小票，按日期和品类整理消费记录",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f3",
    theme_color: "#f5f6f3",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
