import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 404, а не 403: посторонним незачем знать, что админка вообще существует.
  if (!(await isAdmin())) notFound();

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-hairline px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-[22px] rounded-md bg-[linear-gradient(135deg,#ffb020,#ff7a3d)]" />
            <span className="font-display text-[17px] font-bold tracking-[-0.03em]">TokiWa</span>
          </Link>
          <span className="rounded-md border border-accent/30 px-2 py-0.5 font-display text-[10px] tracking-[0.16em] text-accent">
            АДМИН
          </span>
        </div>

        <Link href="/" className="text-[13px] text-subtle transition-colors hover:text-foreground">
          На сайт →
        </Link>
      </header>

      {children}
    </main>
  );
}
