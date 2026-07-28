/**
 * Отправка почты через Resend. Без RESEND_API_KEY весь модуль — тихий no-op,
 * как и telegram.ts: локальная разработка и прод без ключа ничего не шлют
 * и ничего не ломают.
 *
 * REST напрямую, без SDK: нам нужен один POST, лишняя зависимость ни к чему.
 * Лимиты бесплатного тарифа (100/день, 2/сек) при нашей сотне пользователей
 * не жмут, но паузу между письмами всё равно держим — см. notify-episodes.
 */

const API_URL = "https://api.resend.com/emails";

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({
  to,
  subject,
  html,
  unsubscribeUrl,
}: {
  to: string;
  subject: string;
  html: string;
  /** Ссылка для List-Unsubscribe: почтовые клиенты рисуют свою кнопку отписки. */
  unsubscribeUrl?: string;
}): Promise<boolean> {
  if (!emailEnabled()) return false;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject,
        html,
        ...(unsubscribeUrl && {
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      }),
    });

    if (!res.ok) {
      console.error("resend:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("resend:", error);
    return false;
  }
}
