import type { MetadataRoute } from "next";

/**
 * PWA-манифест: с ним Android предлагает «Установить приложение», а иконка
 * на рабочем столе открывает сайт в полный экран, без адресной строки.
 * Больше половины трафика — телефоны, для них это и есть «приложение»,
 * только без магазинов и второй кодовой базы. Заодно первый шаг к пушам.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TokiWa — аниме-трекер",
    short_name: "TokiWa",
    description: "Трекер аниме: списки, прогресс по сериям и подсчёт, сколько времени займёт ваш бэклог.",
    start_url: "/",
    display: "standalone",
    background_color: "#050506",
    theme_color: "#050506",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Отдельная maskable: системная маска срезает края, знак — в центре.
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
