"use server";

import { prisma } from "@/lib/prisma";
import { getActorId, getViewerId } from "@/lib/guest";

/**
 * Записывает ответ на короткий опрос. Один ответ на вопрос от человека:
 * повторный клик просто перезапишет прежний, а не наплодит строк.
 */
export async function answerPoll(question: string, answer: string): Promise<{ ok: boolean }> {
  const userId = await getActorId();

  await prisma.pollAnswer.upsert({
    where: { userId_question: { userId, question } },
    create: { userId, question, answer },
    update: { answer },
  });

  return { ok: true };
}

/** Что человек уже отвечал. null — вопрос ещё не задавали. */
export async function getPollAnswer(question: string): Promise<string | null> {
  const viewerId = await getViewerId();
  if (!viewerId) return null;

  const row = await prisma.pollAnswer.findUnique({
    where: { userId_question: { userId: viewerId, question } },
    select: { answer: true },
  });

  return row?.answer ?? null;
}
