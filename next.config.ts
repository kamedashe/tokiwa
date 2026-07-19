import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Обложки и баннеры.
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "shikimori.io" },
      // Аватары пользователей.
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],

    // С Next 16 значения quality придётся объявлять заранее. Перечисляем те,
    // что реально используются: 20 — размытая подложка в шапке, 85 — карточки,
    // 95 — крупный постер.
    qualities: [20, 85, 95],
  },
};

export default withNextIntl(nextConfig);
