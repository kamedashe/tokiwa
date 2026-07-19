"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWatchLink, deleteWatchLink } from "@/lib/watch-links";
import { SERVICES, SERVICE_KEYS } from "@/lib/services";
import type { WatchLinkRow } from "@/components/watch-links";

export function WatchLinkEditor({
  titleId,
  links,
}: {
  titleId: number;
  links: WatchLinkRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Сервисы, для которых ссылка уже есть, предлагать незачем.
  const used = new Set(links.map((l) => l.service));
  const available = SERVICE_KEYS.filter((k) => !used.has(k));

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createWatchLink(titleId, formData);
      if (!result.ok) {
        setError(result.error ?? "Не удалось сохранить");
        return;
      }
      router.refresh();
    });
  };

  const remove = (linkId: number) => {
    startTransition(async () => {
      const result = await deleteWatchLink(linkId);
      if (!result.ok) {
        setError(result.error ?? "Не удалось удалить");
        return;
      }
      router.refresh();
    });
  };

  return (
    <section>
      <h2 className="mb-1 font-display text-[17px] font-semibold tracking-[-0.02em]">
        Где посмотреть <span className="text-dim">{links.length}</span>
      </h2>
      <p className="mb-3 text-[12px] text-dim">
        Легальные сервисы, которые не дают встраивать себя. Список закрытый — произвольный хост
        сюда не вписать.
      </p>

      {links.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {links.map((link) => {
            const info = SERVICES[link.service];
            return (
              <div
                key={link.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-white/[0.02] px-4 py-3"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: info?.color ?? "#666" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px]">
                    {info?.label ?? link.service}
                    {link.note && <span className="ml-2 text-[12px] text-dim">{link.note}</span>}
                  </div>
                  <div className="truncate text-[12px] text-dim" title={link.url}>
                    {link.url}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(link.id)}
                  disabled={pending}
                  className="rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-60"
                >
                  Убрать
                </button>
              </div>
            );
          })}
        </div>
      )}

      {available.length > 0 ? (
        <form action={submit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-dim">Сервис</span>
            <select
              name="service"
              required
              defaultValue={available[0]}
              className="rounded-lg border border-hairline bg-white/5 px-3 py-2 text-[14px] focus:border-accent/50 focus:outline-none"
            >
              {available.map((key) => (
                <option key={key} value={key} className="bg-surface-2">
                  {SERVICES[key].label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <span className="text-[12px] text-dim">Ссылка на страницу тайтла</span>
            <input
              name="url"
              required
              placeholder="https://…"
              className="rounded-lg border border-hairline bg-white/5 px-3 py-2 font-mono text-[13px] placeholder:text-faint focus:border-accent/50 focus:outline-none"
            />
          </label>

          <label className="flex w-[150px] flex-col gap-1.5">
            <span className="text-[12px] text-dim">Пометка</span>
            <input
              name="note"
              placeholder="Дубляж"
              className="rounded-lg border border-hairline bg-white/5 px-3 py-2 text-[14px] placeholder:text-faint focus:border-accent/50 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-5 py-2.5 text-[14px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-60"
          >
            {pending ? "Сохраняю…" : "Добавить"}
          </button>
        </form>
      ) : (
        <p className="text-[13px] text-subtle">Все сервисы из списка уже добавлены.</p>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
          {error}
        </div>
      )}
    </section>
  );
}
