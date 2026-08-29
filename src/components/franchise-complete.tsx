"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { completeMany, getEntries } from "@/lib/watchlist";

/**
 * «Отметить франшизу просмотренной» — одно действие вместо четырёх.
 *
 * Половина людей со списком держит в нём часть франшизы и не отмечает
 * остальные. Посмотрел человек «Стального алхимика» один раз, а записать
 * это надо четырьмя отдельными нажатиями — и список у большинства так и
 * заканчивается на первом сезоне.
 *
 * Одной кнопкой вслепую тут нельзя: у медианной франшизы два соседа, но
 * встречаются и на семьдесят. Поэтому сначала показываем, что именно
 * отметится, с галочками — кто смотрел только первый сезон, снимет лишние
 * и получит честный список, а не удобное враньё.
 */

export interface FranchisePart {
  id: number;
  title: string;
  year: number | null;
  format: string | null;
}

export function FranchiseComplete({
  sourceTitleId,
  parts,
}: {
  sourceTitleId: number;
  parts: FranchisePart[];
}) {
  const t = useTranslations("title");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [marked, setMarked] = useState<number | null>(null);
  // undefined — ещё не знаем, что у человека отмечено: страница кэшируется,
  // и личное приходит отдельным запросом.
  const [done, setDone] = useState<Set<number> | undefined>(undefined);
  const [unchecked, setUnchecked] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    getEntries(parts.map((p) => p.id))
      .then((rows) => {
        if (cancelled) return;
        setDone(new Set(rows.filter((r) => r.status === "completed").map((r) => r.titleId)));
      })
      .catch(() => !cancelled && setDone(new Set()));

    return () => {
      cancelled = true;
    };
  }, [parts]);

  if (!done) return null;

  const pendingParts = parts.filter((p) => !done.has(p.id));
  if (pendingParts.length === 0) return null;

  // Считаем от «снятых», а не от «отмеченных»: галочки стоят заранее у всего
  // непросмотренного — человек пришёл сюда, потому что смотрел франшизу, а не
  // чтобы расставлять их руками.
  const checked = new Set(pendingParts.filter((p) => !unchecked.has(p.id)).map((p) => p.id));

  const toggle = (id: number) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () => {
    const ids = [...checked];
    startTransition(async () => {
      const result = await completeMany(sourceTitleId, ids);
      if (result.ok) {
        setMarked(result.marked);
        setOpen(false);
      }
    });
  };

  if (marked !== null) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] px-4 py-3 text-[13px] font-semibold text-accent">
        ✓ {t("franchiseDone", { count: marked })}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-full border border-hairline bg-white/[0.03] px-4 py-2 text-[12px] text-muted transition-colors hover:border-white/20 hover:text-foreground"
      >
        {t("franchiseMark", { count: pendingParts.length })}
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-hairline bg-white/[0.02] p-3.5">
          <p className="mb-2.5 text-[12px] leading-relaxed text-dim">{t("franchiseHint")}</p>

          <div className="-mx-1 max-h-[280px] overflow-y-auto">
            {pendingParts.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-white/[0.04]"
              >
                <input
                  type="checkbox"
                  checked={checked.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="mt-0.5 size-3.5 shrink-0 accent-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] leading-snug text-foreground">{p.title}</span>
                  <span className="text-[11px] text-dim">
                    {[p.format, p.year].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={apply}
            disabled={pending || checked.size === 0}
            className="mt-3 w-full rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-40"
          >
            {pending ? t("franchiseWorking") : t("franchiseApply", { count: checked.size })}
          </button>
        </div>
      )}
    </div>
  );
}
