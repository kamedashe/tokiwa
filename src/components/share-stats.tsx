"use client";

import { useState } from "react";

/**
 * Шаринг итогов. Главное — картинка 1080×1920: текстом делятся редко,
 * сторис репостят охотно.
 *
 * Отправить файл умеет только Web Share второго уровня, да и тот капризен:
 * после ожидания сети право на открытие системного окна успевает истечь.
 * Поэтому любое падение шаринга — не тупик, а переход к скачиванию.
 */
export function ShareStats({
  locale,
  text,
  labels,
}: {
  locale: string;
  text: string;
  labels: {
    shareImage: string;
    preparing: string;
    shareTextOnly: string;
    copied: string;
    failed: string;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Ссылку обязательно кладём в документ, а адрес освобождаем с задержкой:
   * click() лишь ставит загрузку в очередь, и мгновенный revoke её отменяет —
   * со стороны выглядит как «кнопка не работает».
   */
  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tokiwa.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const shareImage = async () => {
    setBusy(true);
    setFailed(false);

    try {
      const res = await fetch(`/api/wrapped-image?locale=${locale}`);
      if (!res.ok) {
        setFailed(true);
        return;
      }

      const blob = await res.blob();
      const file = new File([blob], "tokiwa.png", { type: "image/png" });

      // Системную шторку шаринга — только тач-устройствам: на телефоне в ней
      // Telegram и Instagram, а на десктопной Windows — Paint и Outlook.
      // На компьютере полезнее сразу скачать файл.
      const touchDevice = window.matchMedia("(pointer: coarse)").matches;

      if (touchDevice && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch (error) {
          // Закрыл окно сам — уважаем выбор и молчим. Любая другая
          // причина (истёкшее разрешение, нет приложений) — скачиваем.
          if ((error as Error)?.name === "AbortError") return;
        }
      }

      download(blob);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={shareImage}
        disabled={busy}
        className="rounded-full bg-accent px-6 py-2.5 text-[14px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-60"
      >
        {busy ? labels.preparing : labels.shareImage}
      </button>

      <button
        type="button"
        onClick={copyText}
        className="text-[13px] text-dim transition-colors hover:text-foreground"
      >
        {copied ? `✓ ${labels.copied}` : labels.shareTextOnly}
      </button>

      {failed && <p className="text-[13px] text-red-400">{labels.failed}</p>}
    </div>
  );
}
