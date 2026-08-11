"use client";

import { useState, useTransition } from "react";
import { answerPoll } from "@/lib/poll-actions";
import { SAVE_POLL } from "@/lib/polls";
import { GoogleSignInButton } from "@/components/google-signin-button";

/**
 * Один вопрос в три кнопки: нужна ли гостю сохранность списка.
 *
 * Три дня уговоров кнопками дали одну регистрацию на тридцать пять гостей, и
 * из этого не понять, дело в подаче или сохранность им попросту не нужна.
 * Спросить прямо — дешевле, чем гадать дальше.
 *
 * Ответ решает и что делать: сказавшему «да» показываем вход тут же, пока
 * он согласен; сказавшему «нет» больше не предлагаем ничего.
 */
export function SavePoll({
  labels,
}: {
  labels: {
    question: string;
    yes: string;
    no: string;
    meh: string;
    thanksYes: string;
    thanksNo: string;
    googleCta: string;
  };
}) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pick = (value: string) => {
    // Ответ показываем сразу: человек уже нажал, ждать сервер незачем.
    setAnswer(value);
    startTransition(() => {
      void answerPoll(SAVE_POLL, value);
    });
  };

  if (answer === "yes") {
    return (
      <div className="mt-6 flex max-w-[720px] flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-accent/25 bg-accent/[0.05] px-5 py-4">
        <p className="min-w-[200px] flex-1 text-[13px] text-muted">{labels.thanksYes}</p>
        <GoogleSignInButton next="/my" label={labels.googleCta} />
      </div>
    );
  }

  if (answer !== null) {
    return (
      <p className="mt-6 max-w-[720px] rounded-2xl border border-hairline bg-white/[0.02] px-5 py-3 text-[13px] text-dim">
        {labels.thanksNo}
      </p>
    );
  }

  return (
    <div className="mt-6 flex max-w-[720px] flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-hairline bg-white/[0.02] px-5 py-4">
      <p className="min-w-[220px] flex-1 text-[14px] leading-snug">{labels.question}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => pick("yes")}
          className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft"
        >
          {labels.yes}
        </button>
        <button
          type="button"
          onClick={() => pick("no")}
          className="rounded-full border border-hairline px-4 py-1.5 text-[13px] text-muted transition-colors hover:border-white/25 hover:text-foreground"
        >
          {labels.no}
        </button>
        <button
          type="button"
          onClick={() => pick("meh")}
          className="rounded-full border border-hairline px-4 py-1.5 text-[13px] text-muted transition-colors hover:border-white/25 hover:text-foreground"
        >
          {labels.meh}
        </button>
      </div>
    </div>
  );
}
