import { routing } from "@/i18n/routing";

export const SITE_URL = "https://www.tokiwa.moe";

/** Канал проекта — новости и фичи. Заодно страховка: сайт может лечь,
 *  а канал останется способом сказать об этом людям. */
export const TELEGRAM_URL = "https://t.me/TokiWa_TG";

/**
 * hreflang для конкретного пути. path — путь без языкового префикса
 * (например "/catalog" или `/anime/${slug}`), с ведущим слэшем.
 *
 * Русский живёт без префикса в адресе (routing.defaultLocale), поэтому и
 * x-default указывает туда же — так его и находят те, чей язык браузера
 * не совпал ни с одной из явных версий.
 */
export function localeAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};

  for (const locale of routing.locales) {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    languages[locale] = `${SITE_URL}${prefix}${path}`;
  }

  languages["x-default"] = languages[routing.defaultLocale];
  return languages;
}

/**
 * Картинка для превью ссылки — та карточка, что разворачивается в чатах.
 * Собирается на лету в /api/og, поэтому рисовать ничего не нужно: меняется
 * подпись — меняется картинка.
 *
 * Размер 1200×630 — то, что ждут телеграм, дискорд и соцсети.
 */
export function ogImage({
  title,
  subtitle,
  poster,
}: {
  title: string;
  subtitle?: string | null;
  poster?: string | null;
}) {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set("subtitle", subtitle);
  if (poster) params.set("poster", poster);

  return {
    url: `${SITE_URL}/api/og?${params.toString()}`,
    width: 1200,
    height: 630,
  };
}
