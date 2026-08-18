import { getTranslations } from "next-intl/server";
import { UserMenuClient } from "@/components/user-menu-client";

/**
 * Обёртка меню профиля: подписи и ссылку на донат готовит сервер, а кто
 * именно смотрит страницу — выясняет уже браузер.
 *
 * Проверку сессии здесь пришлось убрать: шапка есть на каждой странице, и
 * из-за неё весь сайт рендерился заново на каждый запрос — включая обходы
 * роботов. Один такой обход каталога сжёг месячную квоту базы.
 */
export async function UserMenu() {
  const t = await getTranslations("nav");
  const footer = await getTranslations("footer");
  const feedback = await getTranslations("feedback");
  const wrapped = await getTranslations("wrapped");
  const support = await getTranslations("support");

  return (
    // Ведём на свою страницу поддержки: там объяснено, за что просим, и
    // там же выбирается платёжка по стране — без чтения заголовков в шапке.
    <UserMenuClient
      donateUrl="/support"
      labels={{
        signIn: t("signIn"),
        myList: t("myList"),
        backlog: t("backlog"),
        wrapped: wrapped("menu"),
        feedback: feedback("title"),
        support: footer("support"),
        supporterBadge: support("badge"),
        signOut: t("signOut"),
      }}
    />
  );
}
