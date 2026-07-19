import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";

/** Аватар со списком и выходом, либо кнопка входа для гостя. */
export async function UserMenu() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-accent px-5 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft"
      >
        Войти
      </Link>
    );
  }

  const { name, image } = session.user;

  return (
    <div className="group relative">
      <Link href="/my" className="block" aria-label="Мой список">
        {image ? (
          <Image
            src={image}
            alt={name ?? "Профиль"}
            width={36}
            height={36}
            className="size-9 rounded-full border border-white/10 object-cover"
          />
        ) : (
          <div className="size-9 rounded-full border border-white/10 bg-[linear-gradient(135deg,#2a2a34,#14141a)]" />
        )}
      </Link>

      {/* Появляется по наведению и по фокусу с клавиатуры. */}
      <div className="invisible absolute right-0 top-full z-50 w-44 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {name && (
            <div className="truncate border-b border-hairline px-4 py-3 text-[13px] text-muted">
              {name}
            </div>
          )}

          <Link href="/my" className="block px-4 py-2.5 text-[13px] text-muted hover:text-foreground">
            Мой список
          </Link>

          <Link
            href="/backlog"
            className="block px-4 py-2.5 text-[13px] text-muted hover:text-foreground"
          >
            Сколько у меня времени
          </Link>

          {session.user.role === "admin" && (
            <Link
              href="/admin"
              className="block px-4 py-2.5 text-[13px] text-accent hover:text-accent-soft"
            >
              Админка
            </Link>
          )}

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-left text-[13px] text-muted hover:text-foreground"
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
