import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  const feedback = await getTranslations("feedback");
  const wrapped = await getTranslations("wrapped");
  const support = await getTranslations("support");
  const donate = pickDonateLink(await visitorCountry());

  const supporter = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isSupporter: true },
      })
    : null;

  return (
    <UserMenuDropdown
      name={name}
      image={image}
      donateUrl={donate?.url ?? null}
      isSupporter={supporter?.isSupporter ?? false}
      labels={{
        myList: t("myList"),
        backlog: t("backlog"),
        wrapped: wrapped("menu"),
        feedback: feedback("title"),
        support: footer("support"),
        supporterBadge: support("badge"),
        signOut: t("signOut"),
      }}
      signOutAction={signOutAction}
    />
  );
}
