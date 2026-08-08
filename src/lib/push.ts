import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

/**
 * Пуш-уведомления в браузер. Единственный канал возврата, который работает
 * без регистрации: подписка привязана к браузеру, как и гостевой список,
 * поэтому её может завести и гость — почты у него нет, а браузер есть.
 *
 * Без ключей VAPID модуль — тихий no-op, как и почта с телеграмом.
 */

let configured = false;

export function pushEnabled(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured || !pushEnabled()) return;

  webpush.setVapidDetails(
    // Контакт для push-сервисов: по нему с нами свяжутся, если рассылка
    // начнёт вести себя как спам.
    `mailto:${process.env.EMAIL_CONTACT ?? "hello@tokiwa.moe"}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Куда ведёт клик по уведомлению. */
  url?: string;
  /** Уведомления с одним тегом схлопываются в одно. */
  tag?: string;
}

/**
 * Шлёт уведомление на все устройства пользователя. Возвращает, сколько
 * подписок приняли сообщение.
 *
 * Отписку браузер нам не сообщает — узнаём только по отказу при отправке.
 * 404 и 410 означают, что подписки больше нет: удаляем сразу. Прочие сбои
 * копим счётчиком, чтобы временная сетевая ошибка не выбрасывала живое
 * устройство.
 */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled()) return 0;
  configure();

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ? `${payload.url}?utm_source=push&utm_medium=notification` : "/my",
    tag: payload.tag,
  });

  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        delivered++;
        if (sub.failures > 0) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { failures: 0 },
          });
        }
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          return;
        }

        const failures = sub.failures + 1;
        if (failures >= 5) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          await prisma.pushSubscription
            .update({ where: { id: sub.id }, data: { failures } })
            .catch(() => {});
        }
      }
    }),
  );

  return delivered;
}

/** Тестовое уведомление — проверить связку «подписка → устройство». */
export async function sendTestPush(userId: string): Promise<number> {
  return sendPush(userId, {
    title: "TokiWa",
    body: "Уведомления включены — так будут приходить новые серии.",
    url: `${SITE_URL}/my`,
    tag: "test",
  });
}
