import { NextResponse } from "next/server";
import { sendTestEpisodeMail } from "@/lib/notify-episodes";
import { emailEnabled } from "@/lib/email";

/**
 * Тест почтовых уведомлений: шлёт демо-письмо «вышли новые серии» на
 * указанный адрес. Только за секретом синков — наружу не торчит.
 *
 *   GET /api/test-email?secret=SYNC_SECRET&to=адрес
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const secret = process.env.SYNC_SECRET;
  if (!secret || searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }

  if (!emailEnabled()) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY или EMAIL_FROM не заданы" },
      { status: 500 },
    );
  }

  const to = searchParams.get("to");
  if (!to || !to.includes("@")) {
    return NextResponse.json({ ok: false, error: "Нужен параметр to=адрес" }, { status: 400 });
  }

  const sent = await sendTestEpisodeMail(to);
  return NextResponse.json({ ok: sent }, { status: sent ? 200 : 502 });
}
