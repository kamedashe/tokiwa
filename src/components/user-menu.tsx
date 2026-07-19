import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/lib/auth-actions";
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

  const { name, image, role } = session.user;

  return (
    <UserMenuDropdown
      name={name}
      image={image}
      isAdmin={role === "admin"}
      labels={{
        myList: t("myList"),
        backlog: t("backlog"),
        admin: t("admin"),
        signOut: t("signOut"),
      }}
      signOutAction={signOutAction}
    />
  );
}
