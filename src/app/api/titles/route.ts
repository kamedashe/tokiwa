import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/titles?q=&genre=&season=&year=&page=&perPage= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim();
  const genre = searchParams.get("genre")?.trim();
  const season = searchParams.get("season")?.trim();
  const year = Number(searchParams.get("year")) || undefined;

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(50, Math.max(1, Number(searchParams.get("perPage")) || 24));

  const where = {
    ...(q ? { OR: [{ title: { contains: q } }, { titleJp: { contains: q } }] } : {}),
    ...(genre ? { genres: { some: { slug: genre } } } : {}),
    ...(season ? { season } : {}),
    ...(year ? { year } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.title.findMany({
      where,
      orderBy: [{ score: "desc" }, { id: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        slug: true,
        title: true,
        titleJp: true,
        posterUrl: true,
        hue: true,
        score: true,
        year: true,
        format: true,
        status: true,
        genres: { select: { name: true, slug: true } },
      },
    }),
    prisma.title.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, perPage });
}
