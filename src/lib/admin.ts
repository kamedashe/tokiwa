import { auth } from "@/auth";

/** Текущий пользователь — админ? */
export async function isAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

/**
 * Проверка для серверных экшенов. Бросает, если не админ — защищать одну лишь
 * страницу мало: экшены дёргаются напрямую по HTTP, мимо всякого UI.
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) throw new Error("Требуется вход");
  if (session.user.role !== "admin") throw new Error("Недостаточно прав");

  return session.user;
}
