import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { FeedbackForm } from "@/components/feedback-form";
import { auth } from "@/auth";

// Шапка показывает профиль текущего пользователя.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "feedback" });
  // Личная страница — в hreflang/sitemap её не заносим, как /my и /backlog.
  return { title: t("title"), robots: { index: false } };
}

export default async function FeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/feedback");

  const t = await getTranslations("feedback");

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-[720px] px-4 py-10 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-2 max-w-[56ch] text-muted">{t("intro")}</p>

        <div className="mt-8">
          <FeedbackForm
            labels={{
              placeholder: t("placeholder"),
              submit: t("submit"),
              sending: t("sending"),
              done: t("done"),
              again: t("again"),
              errors: {
                unauthenticated: t("error.unauthenticated"),
                empty: t("error.empty"),
                tooLong: t("error.tooLong"),
                tooMany: t("error.tooMany"),
              },
            }}
          />
        </div>
      </div>

      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}
