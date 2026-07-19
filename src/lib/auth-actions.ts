"use server";

import { signOut } from "@/auth";

/**
 * Отдельный файл ради самого факта "use server": серверный экшен нужно
 * передать пропом в клиентский компонент (UserMenuDropdown), а инлайновый
 * action в форме там не сработает — он должен идти с сервера, не создаваться
 * на клиенте.
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
