import { routing } from "@/i18n/routing";

export const SITE_URL = "https://www.tokiwa.moe";

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
