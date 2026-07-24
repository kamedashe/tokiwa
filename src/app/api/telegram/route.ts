import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Вебхук Telegram-бота. Регистрируется один раз:
 *
 *   curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://www.tokiwa.moe/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 *
 * Секрет Telegram присылает в заголовке с каждым апдейтом — без него любой
 * прохожий мог бы слать боту фальшивые /start и угонять чужие привязки.
 */

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number };
  };
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const chatIdRaw = update?.message?.chat?.id;
  const text = update?.message?.text ?? "";

  // Не наш формат апдейта — отвечаем 200, иначе Telegram будет ретраить.
  if (typeof chatIdRaw !== "number" || typeof text !== "string") {
    return NextResponse.json({ ok: true });
  }

  const chatId = BigInt(chatIdRaw);

  if (text.startsWith("/start")) {
    const code = text.split(" ")[1]?.trim();

    if (code) {
      const link = await prisma.telegramLink.findUnique({ where: { code } });

      if (link && link.codeExpiresAt && link.codeExpiresAt > new Date()) {
        await prisma.telegramLink.update({
          where: { userId: link.userId },
          data: { chatId, code: null, codeExpiresAt: null },
        });
        await sendTelegramMessage(
          chatId,
          "✅ Уведомления подключены! Напишу, когда у тайтлов из «Смотрю» выйдут новые серии.\n\nОтключить: /stop",
        );
        return NextResponse.json({ ok: true });
      }
    }

    await sendTelegramMessage(
      chatId,
      "Привет! Подключение — кнопкой на https://www.tokiwa.moe/my — так я пойму, чей это список.",
    );
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/stop")) {
    await prisma.telegramLink.deleteMany({ where: { chatId } });
    await sendTelegramMessage(chatId, "Отключил. Вернуть можно той же кнопкой на сайте.");
  }

  return NextResponse.json({ ok: true });
}
