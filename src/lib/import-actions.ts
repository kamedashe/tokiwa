"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchShikimoriList, readMalExport, type ImportedEntry } from "@/lib/import-list";
import { upsertFromShikimori } from "@/lib/sync";

export interface ImportResult {
  /** Добавлено в список. */
  added: number;
  /** Уже были у пользователя — такие не трогаем. */
  skipped: number;
  /** Не успели дотянуть в каталог за отведённое время. */
  missing: number;
}

/**
 * Сколько времени тратим на дозагрузку тайтлов, которых у нас ещё нет.
 * Упираемся в скорость Shikimori (~секунда на тайтл с учётом их лимитов),
 * поэтому за заход успеваем десяток-полтора. Что не успели — доедет при
 * повторном импорте, так что ничего не теряется.
 */
const BACKFILL_BUDGET_MS = 20_000;

/**
 * Тянет недостающие тайтлы прямо во время импорта.
 *
 * Без этого фича бессмысленна: в каталоге пара сотен тайтлов, а в живом
 * списке пользователя — свои шестьсот, и пересечение выходит около 4%.
 * Источник — Shikimori, а не Jikan: тот на точечных запросах стабильно
 * отдаёт 504 и с ретраями тратит ~20 секунд на тайтл.
 */
async function backfillMissing(malIds: number[]): Promise<number> {
  const deadline = Date.now() + BACKFILL_BUDGET_MS;
  const queue = [...malIds];
  let pulled = 0;

  // Три параллельных потока: запросы всё равно выстраивает в очередь общий
  // троттлинг Shikimori, зато запись в БД идёт поверх сетевых пауз, а не
  // после них — на практике это втрое быстрее последовательного обхода.
  async function worker() {
    for (;;) {
      const malId = queue.shift();
      if (malId === undefined || Date.now() > deadline) return;

      try {
        if (await upsertFromShikimori(malId)) pulled++;
      } catch {
        // Битый id или источник прилёг — остальной импорт из-за этого не рушим.
      }
    }
  }

  await Promise.all([worker(), worker(), worker()]);
  return pulled;
}

export type ImportResponse =
  | ({ ok: true } & ImportResult)
  | { ok: false; reason: "unauthenticated" | "notFound" | "failed" | "empty" };

/**
 * Кладёт чужой список в наш. Тайтлы, которые у пользователя уже есть, не
 * перезаписываем: свой прогресс на сайте важнее импортированного, а импорт
 * почти всегда разовый и первичный.
 */
async function applyEntries(entries: ImportedEntry[]): Promise<ImportResponse> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "unauthenticated" };
  if (entries.length === 0) return { ok: false, reason: "empty" };

  const userId = session.user.id;

  // Дубли по malId возможны — оставляем первое вхождение.
  const unique = new Map<number, ImportedEntry>();
  for (const e of entries) if (!unique.has(e.malId)) unique.set(e.malId, e);

  const wanted = [...unique.keys()];
  let titles = await prisma.title.findMany({
    where: { malId: { in: wanted } },
    select: { id: true, malId: true },
  });

  // Чего нет в каталоге — пробуем дотянуть, иначе импортировать почти нечего.
  const known = new Set(titles.map((t) => t.malId));
  const absent = wanted.filter((id) => !known.has(id));

  if (absent.length > 0 && (await backfillMissing(absent)) > 0) {
    titles = await prisma.title.findMany({
      where: { malId: { in: wanted } },
      select: { id: true, malId: true },
    });
  }

  const existing = await prisma.watchlistEntry.findMany({
    where: { userId, titleId: { in: titles.map((t) => t.id) } },
    select: { titleId: true },
  });
  const alreadyHave = new Set(existing.map((e) => e.titleId));

  const rows = titles
    .filter((t) => !alreadyHave.has(t.id))
    .map((t) => {
      const entry = unique.get(t.malId!)!;
      return { userId, titleId: t.id, status: entry.status, progress: entry.progress };
    });

  if (rows.length > 0) {
    await prisma.watchlistEntry.createMany({ data: rows, skipDuplicates: true });
    revalidatePath("/");
    revalidatePath("/my");
  }

  return {
    ok: true,
    added: rows.length,
    skipped: alreadyHave.size,
    missing: unique.size - titles.length,
  };
}

/** Импорт с Shikimori по нику — данные тянем из их открытого API. */
export async function importFromShikimori(nickname: string): Promise<ImportResponse> {
  const trimmed = nickname.trim();
  if (!trimmed) return { ok: false, reason: "notFound" };

  const list = await fetchShikimoriList(trimmed);
  if (!list.ok) return { ok: false, reason: list.reason };

  return applyEntries(list.entries);
}

/** Импорт с MAL — из XML-выгрузки, которую пользователь загружает файлом. */
export async function importFromMalFile(formData: FormData): Promise<ImportResponse> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "empty" };

  // 20 МБ с запасом: даже список на десятки тысяч тайтлов в gzip сильно меньше.
  if (file.size > 20 * 1024 * 1024) return { ok: false, reason: "failed" };

  let entries: ImportedEntry[];
  try {
    entries = readMalExport(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, reason: "failed" };
  }

  return applyEntries(entries);
}
