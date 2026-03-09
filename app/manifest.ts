import type { MetadataRoute } from "next";

import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "PT 전용 맨몸 스쿼트 스크리닝 PWA",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f3e7",
    theme_color: "#c75a1b",
    lang: "ko",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
