import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { getWrappedStats } from "@/lib/wrapped-queries";

/**
 * Статистика итогов в JSON — кормит edge-рендерер картинки.
 *
 * Разделение вынужденное: Prisma живёт только на Node, а рендерер картинок
 * стабильно работает только на edge — его wasm-движки при Node-рантайме
 * роняют функцию ещё на импорте, до любого try/catch. Авторизация сквозная:
 * edge-роут пересылает сюда куки исходного запроса.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("locale") ?? routing.defaultLocale;
  const locale = (routing.locales as readonly string[]).includes(raw) ? raw : routing.defaultLocale;

  const stats = await getWrappedStats(locale);
  if (!stats || stats.watchedMinutes === 0) {
    return NextResponse.json({ error: "empty" }, { status: 404 });
  }

  return NextResponse.json(stats);
}
