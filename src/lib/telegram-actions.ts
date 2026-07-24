"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { telegramBotUsername } from "@/lib/telegram";

export type TelegramLinkResponse =
  | { ok: true; url: string }
  | { ok: false; reason: "unauthenticated" | "disabled" };

/**
 * Выдаёт ссылку t.me/бот?start=код. Код одноразовый и живёт 15 минут —
 * этого хватает нажать Start, а протухший никому не пригодится.
 */
export async function createTelegramLink(): Promise<TelegramLinkResponse> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "unauthenticated" };

  const bot = telegramBotUsername();
  if (!bot) return { ok: false, reason: "disabled" };

  const code = randomBytes(8).toString("hex");
  const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.telegramLink.upsert({
    where: { userId: session.user.id },
    // Повторная привязка перезаписывает старый чат — у пользователя один
    // актуальный Telegram, а не коллекция.
    create: { userId: session.user.id, code, codeExpiresAt },
    update: { code, codeExpiresAt },
  });

  return { ok: true, url: `https://t.me/${bot}?start=${code}` };
}

/** Отключает уведомления — то же самое, что /stop в боте. */
export async function unlinkTelegram(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  await prisma.telegramLink.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/my");
  return { ok: true };
}
