"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type FeedbackResponse =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "empty" | "tooLong" | "tooMany" };

/** Больше и не отзыв уже, а поэма — таким лучше в Discord или на почту. */
const MAX_LENGTH = 2000;

/** Потолок в сутки на пользователя — от заливки мусором через форму. */
const MAX_PER_DAY = 5;

export async function submitFeedback(formData: FormData): Promise<FeedbackResponse> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "unauthenticated" };

  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { ok: false, reason: "empty" };
  if (message.length > MAX_LENGTH) return { ok: false, reason: "tooLong" };

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.feedback.count({
    where: { userId: session.user.id, createdAt: { gte: dayAgo } },
  });
  if (recent >= MAX_PER_DAY) return { ok: false, reason: "tooMany" };

  await prisma.feedback.create({
    data: { userId: session.user.id, message },
  });

  return { ok: true };
}
