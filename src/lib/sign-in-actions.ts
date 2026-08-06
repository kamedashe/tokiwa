"use server";

import { signIn } from "@/auth";

/**
 * Вход через Google одним экшеном — чтобы кнопку можно было ставить прямо
 * в баннеры и нуджи, минуя страницу /login. Каждый лишний экран на этой
 * воронке режет прохождение примерно вдвое, а страница логина для гостя
 * с накопленным списком — именно лишний экран.
 */
export async function signInWithGoogle(next: string) {
  // Только свои относительные пути — иначе это открытый редирект.
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/my";
  await signIn("google", { redirectTo: safe });
}
