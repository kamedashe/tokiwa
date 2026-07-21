import Script from "next/script";

/**
 * Cloudflare Web Analytics — бесплатный без исключений (в отличие от Vercel
 * Analytics, где включение на Hobby-плане в итоге тоже упирается в оплату).
 * Ограничения: 10% сэмплирование, хранение 30 дней, топ-15 в отчётах —
 * для «идёт ли трафик и откуда» этого достаточно.
 *
 * Токен не задан — компонент просто ничего не рендерит, как и донат-ссылка.
 */
export function CloudflareAnalytics() {
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN?.trim();
  if (!token) return null;

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
      strategy="afterInteractive"
    />
  );
}
