"use client";

import { useState, useTransition } from "react";
import { submitFeedback, type FeedbackResponse } from "@/lib/feedback-actions";

export function FeedbackForm({
  labels,
}: {
  labels: {
    placeholder: string;
    submit: string;
    sending: string;
    done: string;
    again: string;
    errors: Record<string, string>;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result: FeedbackResponse = await submitFeedback(formData);
      if (!result.ok) {
        setError(labels.errors[result.reason] ?? labels.errors.empty);
        return;
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] px-6 py-10 text-center">
        <p className="text-foreground">{labels.done}</p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-[13px] text-accent transition-colors hover:text-accent-soft"
        >
          {labels.again}
        </button>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <textarea
        name="message"
        required
        maxLength={2000}
        rows={7}
        placeholder={labels.placeholder}
        className="w-full resize-y rounded-2xl border border-hairline bg-white/[0.03] px-5 py-4 text-[15px] leading-relaxed placeholder:text-faint focus:border-accent/50 focus:outline-none"
      />

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-6 py-2.5 text-[14px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-60"
        >
          {pending ? labels.sending : labels.submit}
        </button>

        {error && <span className="text-[13px] text-red-400">{error}</span>}
      </div>
    </form>
  );
}
