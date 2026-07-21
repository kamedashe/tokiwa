import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/lib/auth-actions";
import { pickDonateLink } from "@/lib/donate";
import { visitorCountry } from "@/lib/geo";
import { UserMenuDropdown } from "@/components/user-menu-dropdown";

/** Аватар со списком и выходом, либо кнопка входа для гостя. */
export async function UserMenu() {
  const t = await getTranslations("nav");
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-accent px-5 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft"
      >
        {t("signIn")}
      </Link>
    );
  }

  const { name, image } = session.user;

  // Донат в меню профиля: его видят вернувшиеся пользователи — та аудитория,
  // которую вообще имеет смысл просить о поддержке. Гостям хватает подвала.
  const footer = await getTranslations("footer");
  const donate = pickDonateLink(await visitorCountry());

  return (
    <UserMenuDropdown
      name={name}
      image={image}
      donateUrl={donate?.url ?? null}
      labels={{
        myList: t("myList"),
        backlog: t("backlog"),
        support: footer("support"),
        signOut: t("signOut"),
      }}
      signOutAction={signOutAction}
    />
  );
}
