import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";

export const metadata = { title: "Вход" };

/** Сообщения об ошибках Auth.js — человеческим языком. */
const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "С этим адресом уже входили другим способом. Войдите тем же сервисом, что и в первый раз.",
  AccessDenied: "Вход отклонён. Возможно, адрес почты не подтверждён у провайдера.",
  Verification: "Ссылка для входа устарела. Попробуйте ещё раз.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const session = await auth();

  // Уже вошли — незачем показывать форму.
  if (session?.user) redirect(safeNext(next));

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto flex max-w-[420px] flex-col items-center px-4 py-24 text-center">
        <div className="mb-6 size-12 rounded-2xl bg-[linear-gradient(135deg,#ffb020,#ff7a3d)]" />

        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Вход в TokiWa</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Нужен, чтобы вести списки «смотрю» и «посмотрел» и продолжать с той серии, на которой
          остановились.
        </p>

        {error && (
          <div className="mt-6 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] leading-relaxed text-red-400">
            {ERRORS[error] ?? "Не удалось войти. Попробуйте ещё раз."}
          </div>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: safeNext(next) });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3.5 text-[15px] font-bold text-[#1f1f1f] transition-opacity hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.1 0 5.71-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.7a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.98c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.7 1.53 15.1.5 12 .5 7.52.5 3.65 3.07 1.7 6.85l3.85 2.98C6.46 7.1 9 4.98 12 4.98Z"
                />
              </svg>
              Войти через Google
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: safeNext(next) });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#5865F2] px-6 py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.21.375-.45.88-.617 1.283a18.4 18.4 0 0 0-5.535 0A12.6 12.6 0 0 0 9.107 3a19.7 19.7 0 0 0-4.435 1.372C1.86 8.575 1.1 12.67 1.48 16.708a19.9 19.9 0 0 0 6.06 3.066c.49-.664.926-1.37 1.301-2.113a12.9 12.9 0 0 1-2.05-.985c.172-.126.34-.258.502-.394a14.2 14.2 0 0 0 12.146 0c.164.14.332.272.502.394-.654.386-1.34.716-2.053.986a15.8 15.8 0 0 0 1.3 2.112 19.8 19.8 0 0 0 6.064-3.067c.445-4.68-.762-8.738-3.195-12.34ZM8.68 14.246c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.334-.955 2.42-2.156 2.42Zm6.64 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.156 2.42 0 1.334-.946 2.42-2.156 2.42Z" />
              </svg>
              Войти через Discord
            </button>
          </form>
        </div>

        <p className="mt-6 text-[12px] leading-relaxed text-dim">
          Мы получаем только имя, аватар и email. Ничего не публикуем от вашего имени.
          <br />
          Входя, вы соглашаетесь с{" "}
          <Link href="/privacy" className="text-subtle underline hover:text-foreground">
            политикой конфиденциальности
          </Link>
          .
        </p>
      </div>

      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}

/**
 * Пускаем редирект только на свои же относительные пути — иначе
 * `?next=https://зло.example` превратит логин в открытый редирект.
 */
function safeNext(next: string | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
