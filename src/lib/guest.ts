import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Гостевой список: считать время можно без регистрации.
 *
 * Гость — это обычная строка User с isGuest=true, привязанная к браузеру
 * анонимной кукой. Благодаря этому весь код списков (экшены, бэклог, итоги)
 * работает для гостя без развилок — меняется только способ узнать «кто это».
 * Регистрация нужна лишь чтобы список не пропал вместе с кукой: при входе
 * записи переезжают в настоящий аккаунт (см. mergeGuestIntoUser).
 */

const GUEST_COOKIE = "tokiwa_guest";
const YEAR_SEC = 60 * 60 * 24 * 365;

/**
 * Кто сейчас смотрит: id аккаунта, id гостя из куки или null.
 * Только чтение — куку не ставит, в базу не пишет (годится для страниц).
 */
export async function getViewerId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const jar = await cookies();
  return jar.get(GUEST_COOKIE)?.value ?? null;
}

/**
 * Кто совершает действие: аккаунт, существующий гость или новый гость.
 * Вызывается только из server actions — там можно ставить куку.
 */
export async function getActorId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;

  if (existing) {
    // Кука может пережить свою строку в базе (чистки, переезды) — проверяем.
    const alive = await prisma.user.findUnique({
      where: { id: existing },
      select: { id: true, isGuest: true },
    });
    // Чужой не-гостевой id в куке — подделка, игнорируем и заводим гостя.
    if (alive?.isGuest) return alive.id;
  }

  const guest = await prisma.user.create({ data: { isGuest: true } });
  jar.set(GUEST_COOKIE, guest.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR_SEC,
    path: "/",
  });

  return guest.id;
}

/**
 * Переносит список гостя в настоящий аккаунт. Зовётся после входа.
 * При конфликте по тайтлу побеждает запись аккаунта: она сохранена
 * осознанно, а гостевую человек успел продублировать до регистрации.
 */
export async function mergeGuestIntoUser(userId: string): Promise<void> {
  const jar = await cookies();
  const guestId = jar.get(GUEST_COOKIE)?.value;
  if (!guestId || guestId === userId) return;

  const guest = await prisma.user.findUnique({
    where: { id: guestId },
    select: { isGuest: true },
  });
  if (!guest?.isGuest) return;

  const existing = await prisma.watchlistEntry.findMany({
    where: { userId },
    select: { titleId: true },
  });
  const taken = new Set(existing.map((e) => e.titleId));

  await prisma.watchlistEntry.updateMany({
    where: { userId: guestId, titleId: { notIn: [...taken] } },
    data: { userId },
  });

  // Остатки (дубли) уйдут каскадом вместе с гостевой строкой.
  await prisma.user.delete({ where: { id: guestId } });
}
