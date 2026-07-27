import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Рендерер картинки итогов на Node-рантайме: без явного указания Vercel
  // не кладёт wasm-движки (yoga/resvg) в бандл функции — локально всё
  // работает, в проде ENOENT и пятисотка.
  // Ключ должен совпасть с тем, как Next назвал функцию, а это между
  // версиями гуляло — перечисляем оба написания, лишний не мешает.
  outputFileTracingIncludes: {
    "/api/wrapped-image": ["./node_modules/next/dist/compiled/@vercel/og/**"],
    "/api/wrapped-image/route": ["./node_modules/next/dist/compiled/@vercel/og/**"],
  },

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
