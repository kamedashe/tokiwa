import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";

export const metadata = { title: "Вход" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await auth();

  // Уже вошли — незачем показывать форму.
  if (session?.user) redirect(safeNext(next));

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto flex max-w-[420px] flex-col items-center px-6 py-24 text-center">
        <div className="mb-6 size-12 rounded-2xl bg-[linear-gradient(135deg,#ffb020,#ff7a3d)]" />

        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Вход в TokiWa</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Нужен, чтобы вести списки «смотрю» и «посмотрел» и продолжать с той серии, на которой
          остановились.
        </p>

        <form
          className="mt-8 w-full"
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

        <p className="mt-6 text-[12px] leading-relaxed text-dim">
          Мы получаем только имя, аватар и email. Ничего не публикуем от вашего имени.
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
