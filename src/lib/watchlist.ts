"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CardTitle } from "@/lib/queries";

/** Статус тайтла у текущего пользователя. null — если не в списке или гость. */
export async function getEntry(titleId: number) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.watchlistEntry.findUnique({
    where: { userId_titleId: { userId: session.user.id, titleId } },
    select: { status: true, progress: true },
  });
}

/**
 * Добавляет тайтл в список или убирает, если он там уже есть.
 * Возвращает новое состояние, чтобы кнопка могла перерисоваться.
 */
export async function toggleWatchlist(titleId: number) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, reason: "unauthenticated" as const };

  const userId = session.user.id;
  const existing = await prisma.watchlistEntry.findUnique({
    where: { userId_titleId: { userId, titleId } },
  });

  if (existing) {
    await prisma.watchlistEntry.delete({ where: { id: existing.id } });
  } else {
    await prisma.watchlistEntry.create({ data: { userId, titleId, status: "planned" } });
  }

  revalidatePath("/");
  revalidatePath("/my");

  return { ok: true as const, inList: !existing };
}

/** Меняет статус (и заодно добавляет, если тайтла в списке ещё не было). */
export async function setStatus(titleId: number, status: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, reason: "unauthenticated" as const };

  const userId = session.user.id;

  await prisma.watchlistEntry.upsert({
    where: { userId_titleId: { userId, titleId } },
    create: { userId, titleId, status },
    update: { status },
  });

  revalidatePath("/");
  revalidatePath("/my");

  return { ok: true as const, status };
}

/** Запоминает, на какой серии остановились. */
export async function setProgress(titleId: number, progress: number) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, reason: "unauthenticated" as const };

  const userId = session.user.id;

  await prisma.watchlistEntry.upsert({
    where: { userId_titleId: { userId, titleId } },
    create: { userId, titleId, status: "watching", progress },
    update: { progress, status: "watching" },
  });

  revalidatePath("/");
  return { ok: true as const };
}

/**
 * Ряд «Продолжить просмотр» из макета — то, что пользователь смотрит сейчас,
 * свежее сверху. Для гостей пусто, и ряд просто не рендерится.
 */
export async function getContinueWatching(limit = 14): Promise<CardTitle[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: session.user.id, status: "watching" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { title: { select: CARD_FIELDS } },
  });

  return entries.map((e) => toCard(e.title));
}

/** Весь список пользователя, сгруппированный по статусу — для страницы /my. */
export async function getMyList() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { status: true, progress: true, title: { select: CARD_FIELDS } },
  });

  const grouped: Record<string, CardTitle[]> = {
    watching: [],
    completed: [],
    planned: [],
    dropped: [],
  };

  for (const e of entries) {
    if (e.status in grouped) grouped[e.status].push(toCard(e.title));
  }

  return grouped;
}

const CARD_FIELDS = {
  id: true,
  slug: true,
  title: true,
  titleRu: true,
  posterUrl: true,
  hue: true,
  score: true,
  genres: { select: { name: true }, take: 2 },
} as const;

function toCard(t: {
  id: number;
  slug: string;
  title: string;
  titleRu: string | null;
  posterUrl: string | null;
  hue: number;
  score: number | null;
  genres: { name: string }[];
}): CardTitle {
  return {
    id: t.id,
    slug: t.slug,
    title: t.titleRu ?? t.title,
    original: t.titleRu ? t.title : null,
    posterUrl: t.posterUrl,
    hue: t.hue,
    score: t.score,
    tags: t.genres.map((g) => g.name).join(" · "),
  };
}
