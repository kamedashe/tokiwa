import { defineRouting } from "next-intl/routing";

/**
 * Локали в URL: /uk/catalog, /en/catalog и так далее.
 *
 * Русский — префикс по умолчанию и потому без префикса в адресе: он остаётся
 * основной аудиторией, а старые ссылки вида /catalog продолжают работать.
 */
export const routing = defineRouting({
  locales: ["ru", "uk", "en", "ja"],
  defaultLocale: "ru",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

/** Подписи для переключателя — каждая на своём языке, так понятнее. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ru: "Русский",
  uk: "Українська",
  en: "English",
  ja: "日本語",
};

/** Короткие метки для компактного переключателя. */
export const LOCALE_SHORT: Record<Locale, string> = {
  ru: "RU",
  uk: "UA",
  en: "EN",
  ja: "JA",
};
