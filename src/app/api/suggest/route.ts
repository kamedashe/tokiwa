import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pickTitle } from "@/lib/title-locale";

/**
 * Подсказки для поля поиска в шапке: несколько тайтлов по началу названия.
 *
 * Запрос ходит на каждую паузу в наборе, поэтому он нарочно дешёвый: семь
 * строк, четыре колонки, никаких связей и никакого count. Ответ кладём в
 * общий кэш — люди набирают одни и те же популярные названия, и вторая
 * «фрирен» за пять минут до базы уже не доходит. Ничего личного в ответе
 * нет, так что кэш безопасен.
 *
 * Осторожность тут не лишняя: именно необдуманные запросы к базе на каждый
 * заход выбрали в августе месячную квоту.
 */

const LIMIT = 7;
const MIN_LENGTH = 2;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 60);
  const locale = searchParams.get("locale") ?? "ru";

  // На одной букве совпадёт половина каталога — подсказки бессмысленны,
  // а база нагружена.
  if (q.length < MIN_LENGTH) {
    return NextResponse.json({ items: [] }, { headers: { "cache-control": "public, max-age=60" } });
  }

  const rows = await prisma.title.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { titleRu: { contains: q, mode: "insensitive" } },
        { titleJp: { contains: q, mode: "insensitive" } },
      ],
    },
    // Сначала популярное: человек почти всегда ищет то, что на слуху.
    orderBy: [{ score: { sort: "desc", nulls: "last" } }],
    take: LIMIT,
    select: { slug: true, title: true, titleRu: true, titleJp: true, year: true, format: true },
  });

  const items = rows.map((r) => ({
    slug: r.slug,
    title: pickTitle(r, locale).title,
    year: r.year,
    format: r.format,
  }));

  return NextResponse.json(
    { items },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
