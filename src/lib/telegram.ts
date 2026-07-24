/**
 * Тонкий клиент Telegram Bot API. Без TELEGRAM_BOT_TOKEN в окружении все
 * вызовы — тихие no-op: инфраструктура готова заранее, бот подключается
 * просто добавлением переменных.
 *
 * Нужные переменные:
 *   TELEGRAM_BOT_TOKEN     — токен от BotFather
 *   TELEGRAM_BOT_USERNAME  — @имя бота без собаки, для ссылки t.me/…?start=
 *   TELEGRAM_WEBHOOK_SECRET — свой секрет, сверяется в вебхуке
 */

const API = "https://api.telegram.org";

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function telegramBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME?.trim() || null;
}

export async function sendTelegramMessage(chatId: bigint, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.toString(),
        text,
        parse_mode: "HTML",
        // Превью первой ссылки съедает пол-экрана — список серий важнее.
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
