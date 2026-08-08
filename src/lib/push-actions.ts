"use server";

import { prisma } from "@/lib/prisma";
import { getActorId, getViewerId } from "@/lib/guest";
import { sendTestPush } from "@/lib/push";

/**
 * Подписка на пуши. Через getActorId — значит гостю тоже заведётся строка
 * User, и уведомления получит человек без единой регистрации.
 */
export async function subscribeToPush(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: boolean }> {
  const userId = await getActorId();

  // Тот же браузер мог подписаться раньше под гостевой кукой — обновляем
  // владельца, чтобы после входа уведомления шли уже в аккаунт.
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
    update: { userId, p256dh: sub.p256dh, auth: sub.auth, failures: 0 },
  });

  // Сразу показываем, как это выглядит: разрешение дали — получите пример.
  await sendTestPush(userId);

  return { ok: true };
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true };
}

/** Есть ли у этого посетителя хоть одна живая подписка. */
export async function hasPushSubscription(): Promise<boolean> {
  const viewerId = await getViewerId();
  if (!viewerId) return false;

  const count = await prisma.pushSubscription.count({ where: { userId: viewerId } });
  return count > 0;
}
