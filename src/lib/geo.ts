import { headers } from "next/headers";

/**
 * Код страны посетителя из заголовка платформы. На Vercel это
 * x-vercel-ip-country, у Cloudflare — cf-ipcountry. Локально их нет,
 * и тогда возвращаем null: значит «показать все сервисы».
 *
 * Точность тут не критична — от неё зависит только порядок ссылок.
 */
export async function visitorCountry(): Promise<string | null> {
  const h = await headers();

  const raw =
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("x-country-code");

  if (!raw) return null;

  const code = raw.trim().toUpperCase();
  // XX означает «не определили».
  return /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}
