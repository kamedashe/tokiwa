"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ImportResponse } from "@/lib/import-actions";

interface Props {
  /** Серверные экшены приходят пропсами — в клиентском компоненте их не создать. */
  importShikimori: (nickname: string) => Promise<ImportResponse>;
  importMal: (formData: FormData) => Promise<ImportResponse>;
}

export function ImportList({ importShikimori, importMal }: Props) {
  const t = useTranslations("import");
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function run(action: () => Promise<ImportResponse>) {
    setResult(null);
    startTransition(async () => setResult(await action()));
  }

  return (
    <div className="px-4 md:px-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-hairline bg-white/[0.03] px-4 py-2 text-[13px] text-muted transition-colors hover:border-white/20 hover:text-foreground"
      >
        {t("open")}
      </button>

      {open && (
        <div className="mt-4 max-w-xl rounded-2xl border border-hairline bg-white/[0.02] p-5">
          <p className="mb-4 text-[13px] leading-relaxed text-dim">{t("intro")}</p>

          <label className="mb-1.5 block font-display text-[11px] tracking-[0.16em] text-dim">
            {t("shikimoriLabel")}
          </label>
          <div className="mb-5 flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("nicknamePlaceholder")}
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-black/20 px-3 py-2 text-[14px] outline-none focus:border-white/25"
            />
            <button
              type="button"
              disabled={pending || nickname.trim() === ""}
              onClick={() => run(() => importShikimori(nickname))}
              className="rounded-lg bg-accent px-4 py-2 text-[14px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-40"
            >
              {t("go")}
            </button>
          </div>

          <label className="mb-1.5 block font-display text-[11px] tracking-[0.16em] text-dim">
            {t("malLabel")}
          </label>
          <p className="mb-2 text-[12px] leading-relaxed text-dim">{t("malHint")}</p>
          <input
            ref={fileInput}
            type="file"
            accept=".xml,.gz,application/gzip,text/xml"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const data = new FormData();
              data.set("file", file);
              run(() => importMal(data));
            }}
            className="block w-full text-[13px] text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-[13px] file:text-foreground hover:file:bg-white/15"
          />

          {pending && <p className="mt-4 text-[13px] text-dim">{t("working")}</p>}

          {result && !pending && (
            <p className="mt-4 text-[13px] leading-relaxed">
              {result.ok ? (
                <span className="text-foreground">
                  {t("done", { added: result.added })}
                  {result.skipped > 0 && ` · ${t("skipped", { count: result.skipped })}`}
                  {result.missing > 0 && ` · ${t("missing", { count: result.missing })}`}
                  {result.missing > 0 && (
                    <span className="mt-1 block text-dim">{t("repeatHint")}</span>
                  )}
                </span>
              ) : (
                <span className="text-red-400">{t(`error.${result.reason}`)}</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
