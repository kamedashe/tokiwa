import { createHmac, timingSafeEqual } from "crypto";
import { SITE_URL } from "@/lib/seo";

/**
 * Подпись ссылки-отписки: HMAC от userId на AUTH_SECRET. Ссылка работает
 * без логина (по ней кликают из почтового клиента, где сессии нет), но
 * подделать её для чужого id без секрета нельзя. Ничего не хранится в базе.
 */

function sign(userId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("hex");
}

export function unsubscribeUrl(userId: string): string {
  return `${SITE_URL}/api/unsubscribe?uid=${encodeURIComponent(userId)}&sig=${sign(userId)}`;
}

export function verifyUnsubscribe(userId: string, sig: string): boolean {
  const expected = Buffer.from(sign(userId));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
