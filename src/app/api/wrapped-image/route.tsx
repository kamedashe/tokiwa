import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getWrappedStats } from "@/lib/wrapped-queries";

/**
 * Картинка итогов 1080×1920 — формат сторис, его и репостят.
 *
 * Node, а не edge: статистику считаем через Prisma. Отсюда же требование к
 * шрифту — без него кириллица станет квадратиками, своих глифов у рендерера
 * нет, а привычный `fetch(new URL(…, import.meta.url))` из примеров про
 * edge на Node падает: файловый протокол он не умеет. Поэтому шрифты лежат
 * в статике и берутся по адресу самого сайта.
 */
export const runtime = "nodejs";

// По умолчанию функции живут 10 секунд, а холодный старт с Prisma, двумя
// шрифтами и отрисовкой 1080×1920 в это окно не влезает — запрос убивался
// на полпути, и кнопка «не работала».
export const maxDuration = 60;

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

  const stats = await getWrappedStats(locale);
  if (!stats || stats.watchedMinutes === 0) {
    return new Response("Нет данных", { status: 404 });
  }

  try {
    const t = await getTranslations({ locale, namespace: "wrapped" });

    // Адрес берём из самого запроса: локально это localhost, в проде — домен.
    const [medium, extraBold] = await Promise.all([
      fetchFont(new URL("/fonts/Manrope-Medium.ttf", request.url)),
      fetchFont(new URL("/fonts/Manrope-ExtraBold.ttf", request.url)),
    ]);

    return renderImage(stats, t, { medium, extraBold });
  } catch (error) {
    // В лог — целиком, наружу — коротко: клиент покажет своё сообщение.
    console.error("wrapped-image:", error);
    return new Response("Не собралось", { status: 500 });
  }
}

/** Битый шрифт роняет рендерер глубоко внутри — проверяем ответ сразу. */
async function fetchFont(url: URL): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`шрифт ${url.pathname}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

type Translate = Awaited<ReturnType<typeof getTranslations<"wrapped">>>;
type Stats = NonNullable<Awaited<ReturnType<typeof getWrappedStats>>>;

function renderImage(
  stats: Stats,
  t: Translate,
  fonts: { medium: ArrayBuffer; extraBold: ArrayBuffer },
) {
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
            {hours}
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
        { name: "Manrope", data: fonts.medium, weight: 500, style: "normal" },
        { name: "Manrope", data: fonts.extraBold, weight: 800, style: "normal" },
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
