"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { checkWatchLink } from "@/lib/services";

export interface LinkActionResult {
  ok: boolean;
  error?: string;
}

export async function createWatchLink(
  titleId: number,
  formData: FormData,
): Promise<LinkActionResult> {
  await requireAdmin();

  const service = String(formData.get("service") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const check = checkWatchLink(service, url);
  if (!check.ok) return { ok: false, error: check.error };

  const title = await prisma.title.findUnique({ where: { id: titleId }, select: { slug: true } });
  if (!title) return { ok: false, error: "Тайтл не найден" };

  try {
    await prisma.watchLink.create({
      data: { titleId, service, url, note: note || null },
    });
  } catch {
    return { ok: false, error: "Ссылка на этот сервис уже есть" };
  }

  revalidatePath(`/admin/titles/${titleId}`);
  revalidatePath(`/anime/${title.slug}`);
  return { ok: true };
}

export async function deleteWatchLink(linkId: number): Promise<LinkActionResult> {
  await requireAdmin();

  const existing = await prisma.watchLink.findUnique({
    where: { id: linkId },
    select: { titleId: true, title: { select: { slug: true } } },
  });
  if (!existing) return { ok: false, error: "Ссылка не найдена" };

  await prisma.watchLink.delete({ where: { id: linkId } });

  revalidatePath(`/admin/titles/${existing.titleId}`);
  revalidatePath(`/anime/${existing.title.slug}`);
  return { ok: true };
}
