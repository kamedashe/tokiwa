import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Личные страницы закрываем на всех языках сразу — «*» в начале паттерна
 * ловит и голый путь («/my»), и с языковым префиксом («/uk/my»), поскольку
 * по robots.txt это не анкорится к началу адреса.
 *
 * /backlog НЕ закрыт: с гостевым режимом это витрина главной фичи — считать
 * можно без входа, и запросы «сколько времени займёт посмотреть …» должны
 * приводить именно сюда.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Адреса-метки — редиректы для рекламы, в индексе им делать нечего.
      disallow: [
        "/api/",
        "*/my",
        "*/login",
        "*/feedback",
        "*/wrapped",
        "/tt",
        "/yt",
        "/ig",
        "/tg",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
