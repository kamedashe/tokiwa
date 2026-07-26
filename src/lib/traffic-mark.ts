import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/seo";

/**
 * Короткие адреса-метки под площадки: `tokiwa.moe/tt` и подобные.
 *
 * Нужны потому, что источник иначе не измерить: в TikTok ссылки некликабельны
 * и домен набирают руками, а Telegram не передаёт реферер даже по клику —
 * и то и другое приходит в аналитику как «прямой заход». Метка добавляет
 * utm-параметры, и переходы видно во вкладке UTM.
 *
 * Метки должны быть исключены из matcher'а в middleware.ts, иначе локализация
 * перепишет их в `/ru/tt` и вернёт 404.
 */
export function markRedirect(source: string) {
  return function GET() {
    const url = new URL(SITE_URL);
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", "social");

    // 307, а не 308: адреса меток временные, кэшировать их в браузере навсегда
    // не нужно — иначе смена площадки потребует нового адреса.
    return NextResponse.redirect(url, 307);
  };
}
