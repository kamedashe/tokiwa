"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { alreadySubscribed, enablePush, pushSupport } from "@/lib/push-client";

/**
 * Просьба включить уведомления в момент, когда человек отметил выходящий
 * тайтл как «смотрю».
 *
 * Почему здесь, а не в «моём списке», где переключатель стоял раньше: у 85%
 * пришедших в списке ровно один тайтл, и до страницы списка они не доходят
 * вовсе — за всё время переключатель внизу той страницы нашёл один человек.
 * Здесь же плашка появляется прямо под пальцем сразу после нажатия, и просить
 * ничего не надо объяснять: серия выходит в четверг, вопрос сам себя объясняет.
 *
 * Спрашиваем в два шага — сперва своей кнопкой, системный диалог только после
 * согласия. Разрешение браузер запоминает навсегда: отказ закрывает канал для
 * устройства без второй попытки, а по доле отказов Chrome ещё и глушит окно
 * сразу всему домену. Поэтому до системного диалога доходят только те, кто уже
 * сказал «да», — иначе спрашивать было бы дороже, чем не спрашивать.
 */

/** Отказ помним локально: спросить ещё раз можно, но не завтра. */
const DISMISSED_KEY = "tokiwa_notify_dismissed";
const QUIET_DAYS = 30;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Boolean(at) && Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function EpisodeNotifyAsk({
  vapidKey,
  nextEpisodeAt,
}: {
  vapidKey: string;
  /** ISO-дата следующей серии, если известна: с ней вопрос конкретнее. */
  nextEpisodeAt: string | null;
}) {
  const t = useTranslations("title");
  const locale = useLocale();
  const [state, setState] = useState<"hidden" | "ask" | "install" | "on" | "blocked">("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const support = pushSupport();
      if (support === "unsupported") return;
      if (dismissedRecently()) return;

      // Уже отказал системно или уже подписан — второй раз не лезем.
      if (typeof Notification !== "undefined" && Notification.permission === "denied") return;
      if (support === "ok" && (await alreadySubscribed())) return;

      if (!cancelled) setState(support === "needs-install" ? "install" : "ask");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "hidden") return null;

  const accept = async () => {
    setBusy(true);
    const result = await enablePush(vapidKey);
    setBusy(false);
    if (result === "on") setState("on");
    else if (result === "blocked") setState("blocked");
    else setState("hidden");
  };

  const decline = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Приватный режим — переживём, просто спросим в следующий раз.
    }
    setState("hidden");
  };

  const when =
    nextEpisodeAt &&
    new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(nextEpisodeAt),
    );

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] px-4 py-3.5">
      {state === "on" ? (
        <div className="text-[13px] font-semibold text-accent">✓ {t("notifyDone")}</div>
      ) : state === "blocked" ? (
        <div className="text-[13px] leading-relaxed text-muted">{t("notifyBlocked")}</div>
      ) : state === "install" ? (
        <div className="text-[13px] leading-relaxed text-muted">{t("notifyIos")}</div>
      ) : (
        <>
          <div className="font-display text-[14px] font-semibold leading-snug">
            {when ? t("notifyAskDated", { date: when }) : t("notifyAsk")}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              className="rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-60"
            >
              {busy ? t("notifyWorking") : t("notifyYes")}
            </button>
            <button
              type="button"
              onClick={decline}
              className="text-[12px] text-dim transition-colors hover:text-foreground"
            >
              {t("notifyNo")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
