import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Оптимизатор Vercel на бесплатном тарифе не тянет каталог в 15 тыс.
    // постеров — квота трансформаций сгорает, картинки отдают 402. Свой
    // лоадер раздаёт картинки напрямую с источников, размер для карточек
    // подбирает из готовых вариантов Shikimori (см. lib/image-loader.ts).
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
};

export default withNextIntl(nextConfig);
