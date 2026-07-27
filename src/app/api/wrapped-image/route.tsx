import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { routing } from "@/i18n/routing";
import ru from "../../../../messages/ru.json";
import uk from "../../../../messages/uk.json";
import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import type { WrappedStats } from "@/lib/wrapped-queries";

/**
 * Картинка итогов 1080×1920 — формат сторис, его и репостят.
 *
 * Рантайм именно edge: на Node wasm-движки рендерера (yoga/resvg) роняют
 * функцию ещё на импорте, до любого try/catch — в проде это выглядело как
 * голая пятисотка Vercel. На edge нет Prisma, поэтому статистику отдаёт
 * соседний Node-роут /api/wrapped-data, а куки пересылаются насквозь —
 * авторизация остаётся той же. Словари подключены статикой: next-intl'ному
 * getTranslations нужен реквест-контекст, а чистому createTranslator — нет.
 */
export const runtime = "edge";

const MESSAGES: Record<string, { wrapped: Record<string, string> }> = { ru, uk, en, ja };

const WIDTH = 1080;
const HEIGHT = 1920;

const INK = "#050506";
const SURFACE = "#14141a";
const FOREGROUND = "#f3f3f6";
const ACCENT = "#ffb020";
const MUTED = "#9a9aa6";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("locale") ?? routing.defaultLocale;
  const locale = (routing.locales as readonly string[]).includes(raw) ? raw : routing.defaultLocale;

  // Демо-данные для отладки рендера без авторизации: локально — свободно,
  // в проде — только с ключом синков, чтобы дверца не торчала наружу.
  const demoAllowed =
    process.env.NODE_ENV !== "production" ||
    (!!process.env.SYNC_SECRET && searchParams.get("secret") === process.env.SYNC_SECRET);
  let stats: WrappedStats;
  if (searchParams.get("demo") === "1" && demoAllowed) {
    stats = {
      watchedMinutes: 57 * 60,
      episodesWatched: 135,
      completedCount: 12,
      droppedCount: 2,
      dropRate: 14,
      topGenres: [
        { name: "Драма", count: 7 },
        { name: "Фантастика", count: 5 },
        { name: "Романтика", count: 4 },
      ],
      longest: { name: "Ван-Пис: очень длинное название тайтла для проверки обрезки", slug: "one-piece", minutes: 26000 },
      avgScore: 8.6,
    } as WrappedStats;
  } else {
    // Куки исходного запроса — иначе Node-ручка не узнает пользователя.
    const statsRes = await fetch(new URL("/api/wrapped-data?locale=" + locale, request.url), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (!statsRes.ok) {
      return new Response("Нет данных", { status: statsRes.status });
    }
    stats = (await statsRes.json()) as WrappedStats;
  }

  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "wrapped" });

  const [medium, extraBold] = await Promise.all([
    fetch(new URL("/fonts/Manrope-Medium.ttf", request.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("/fonts/Manrope-ExtraBold.ttf", request.url)).then((r) => r.arrayBuffer()),
  ]);

  const hours = Math.round(stats.watchedMinutes / 60);
  const days = Math.round(stats.watchedMinutes / 60 / 24);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          padding: 90,
          fontFamily: "Manrope",
          color: FOREGROUND,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* display: flex обязателен всюду, где детей больше одного —
              иначе рендерер падает, а не просто криво рисует. */}
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
            <span>TokiWa</span>
            {/* Точка вплотную к слову — у глифа свой отступ слева. */}
            <span style={{ marginLeft: -6, color: ACCENT }}>.</span>
          </div>
          <div style={{ marginTop: 14, fontSize: 34, color: MUTED }}>{t("title")}</div>
        </div>

        {/* Главное число — ради него картинкой и делятся. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 34, letterSpacing: 6, color: ACCENT }}>{t("hoursWatched")}</div>
          <div
            style={{
              marginTop: 10,
              fontSize: 320,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -14,
              color: ACCENT,
            }}
          >
            {/* Только строкой: число как ребёнок JSX роняет рендерер
                посреди стрима — снаружи это 200 и пустой файл. */}
            {String(hours)}
          </div>
          {days >= 1 && (
            <div style={{ marginTop: 18, fontSize: 44, color: MUTED }}>{t("daysOfLife", { days })}</div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", gap: 22 }}>
            <Stat label={t("episodes")} value={String(stats.episodesWatched)} />
            <Stat label={t("completed")} value={String(stats.completedCount)} />
          </div>

          {stats.topGenres.length > 0 && (
            <Card label={t("topGenres")} value={stats.topGenres.map((g) => g.name).join(" · ")} />
          )}

          {stats.longest && <Card label={t("longest")} value={stats.longest.name} />}
        </div>

        <div style={{ display: "flex", justifyContent: "center", fontSize: 40, color: ACCENT }}>
          tokiwa.moe
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Manrope", data: medium, weight: 500, style: "normal" },
        { name: "Manrope", data: extraBold, weight: 800, style: "normal" },
      ],
    },
  );
}

/** Половина ряда: крупное число и подпись. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: SURFACE,
        borderRadius: 32,
        padding: 34,
      }}
    >
      <div style={{ fontSize: 26, letterSpacing: 3, color: MUTED }}>{label.toUpperCase()}</div>
      <div style={{ marginTop: 10, fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>{value}</div>
    </div>
  );
}

/** Строка во всю ширину — для жанров и названия тайтла. */
function Card({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: SURFACE,
        borderRadius: 32,
        padding: 34,
      }}
    >
      <div style={{ fontSize: 26, letterSpacing: 3, color: MUTED }}>{label.toUpperCase()}</div>
      <div
        style={{
          marginTop: 10,
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: -1,
          // Длинные названия тайтлов рвут вёрстку — обрезаем одной строкой.
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}
