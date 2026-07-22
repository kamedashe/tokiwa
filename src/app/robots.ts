import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * /my, /backlog, /login, /feedback закрываем на всех языках сразу — «*» в
 * начале паттерна ловит и голый путь («/my»), и с языковым префиксом
 * («/uk/my»), поскольку по robots.txt это не анкорится к началу адреса.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "*/my", "*/backlog", "*/login", "*/feedback"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
