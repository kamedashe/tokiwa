/**
 * Партнёрские ссылки. Шаблон задаётся в окружении на каждый сервис — он
 * привязан к твоему аккаунту в CPA-сети (Admitad, Actionpay и т.п.), поэтому
 * в коде его держать нельзя.
 *
 * Формат: строка с плейсхолдером {url}, куда подставляется закодированный
 * адрес страницы тайтла. Пример для Admitad:
 *   AFFILIATE_OKKO="https://ad.admitad.com/g/abc123/?ulp={url}"
 *
 * Шаблона нет — отдаём обычную ссылку. Ничего не ломается.
 */

export interface AffiliateResult {
  url: string;
  /** Партнёрская ли ссылка — от этого зависит пометка и rel. */
  sponsored: boolean;
}

function templateFor(service: string): string | null {
  const key = `AFFILIATE_${service.toUpperCase()}`;
  const value = process.env[key]?.trim();
  return value || null;
}

export function affiliateUrl(service: string, url: string): AffiliateResult {
  const template = templateFor(service);
  if (!template || !template.includes("{url}")) return { url, sponsored: false };

  return {
    url: template.replace("{url}", encodeURIComponent(url)),
    sponsored: true,
  };
}
