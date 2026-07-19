/**
 * Донаты. Как и партнёрки — включаются переменной окружения, ничего не
 * ломается, если её нет.
 *
 * Boosty принимает карты РФ и Украины, Ko-fi работает через Stripe и
 * российскую карту не примет, зато международный. Если задана только
 * одна ссылка — показываем её всем. Если обе — выбираем по стране
 * посетителя, тем же geo-заголовком, что и «Где посмотреть».
 */

export interface DonateLink {
  provider: string;
  url: string;
}

const REGIONS: Record<string, string[]> = {
  boosty: ["RU", "UA"],
  kofi: ["*"],
};

function configuredLinks(): Record<string, string> {
  const out: Record<string, string> = {};
  const boosty = process.env.DONATE_BOOSTY_URL?.trim();
  const kofi = process.env.DONATE_KOFI_URL?.trim();
  if (boosty) out.boosty = boosty;
  if (kofi) out.kofi = kofi;
  return out;
}

export function pickDonateLink(country: string | null): DonateLink | null {
  const links = configuredLinks();
  const keys = Object.keys(links);
  if (keys.length === 0) return null;

  if (country) {
    const regional = keys.find((k) => REGIONS[k]?.includes(country));
    if (regional) return { provider: regional, url: links[regional] };
  }

  const universal = keys.find((k) => REGIONS[k]?.includes("*"));
  if (universal) return { provider: universal, url: links[universal] };

  const fallback = keys[0];
  return { provider: fallback, url: links[fallback] };
}
