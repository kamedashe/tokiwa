import { prisma } from "@/lib/prisma";
import { getViewerId } from "@/lib/guest";
import { pickTitle } from "@/lib/title-locale";
import { routing } from "@/i18n/routing";

/**
 * Выгрузка списка в CSV.
 *
 * Нужна не ради галочки: список гостя живёт в куке браузера, и человек об
 * этом обычно не догадывается — для него сайт такое же приложение, где
 * «данные где-то сохранились». Возможность забрать список файлом честнее
 * любых предупреждений: она превращает «поверьте, что не потеряете» в
 * «вот ваши данные, держите».
 *
 * CSV, а не JSON: открывается в любой таблице, не требует ничего объяснять.
 */

/** Экранирование по правилам CSV: кавычки удваиваются, поле берётся в кавычки. */
function cell(value: string | number | null): string {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const viewerId = await getViewerId();
  if (!viewerId) return new Response("Список пуст", { status: 404 });

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("locale") ?? routing.defaultLocale;
  const locale = (routing.locales as readonly string[]).includes(raw) ? raw : routing.defaultLocale;

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: viewerId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      status: true,
      progress: true,
      updatedAt: true,
      title: {
        select: {
          slug: true,
          title: true,
          titleRu: true,
          titleJp: true,
          malId: true,
          year: true,
          episodesCount: true,
          score: true,
        },
      },
    },
  });

  if (entries.length === 0) return new Response("Список пуст", { status: 404 });

  const header = [
    "Название",
    "Оригинал",
    "Статус",
    "Просмотрено серий",
    "Всего серий",
    "Год",
    "Оценка",
    "Ссылка",
    "MAL ID",
    "Изменено",
  ];

  const STATUS: Record<string, string> = {
    watching: "смотрю",
    completed: "просмотрено",
    planned: "запланировано",
    dropped: "брошено",
  };

  const rows = entries.map((e) => {
    const names = pickTitle(e.title, locale);
    return [
      cell(names.title),
      cell(names.original ?? e.title.titleJp),
      cell(STATUS[e.status] ?? e.status),
      cell(e.progress),
      cell(e.title.episodesCount),
      cell(e.title.year),
      cell(e.title.score),
      cell(`https://www.tokiwa.moe/anime/${e.title.slug}`),
      cell(e.title.malId),
      cell(e.updatedAt.toISOString().slice(0, 10)),
    ].join(",");
  });

  // BOM в начале: без него Excel открывает кириллицу кракозябрами.
  const csv = "﻿" + [header.map(cell).join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tokiwa-${date}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
