import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/**
 * Подгружает словарь для текущего запроса. Неизвестная локаль в адресе
 * откатывается на дефолтную, а не роняет страницу.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
