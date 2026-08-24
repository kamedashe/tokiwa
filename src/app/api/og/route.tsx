import { ImageResponse } from "next/og";

/**
 * Картинка-превью для ссылок: то, что видит человек, когда ссылку кидают
 * в чат. Без неё телеграм и дискорд показывают голый текст, и сайт выглядит
 * несерьёзно ровно в тот момент, когда им делятся.
 *
 * Рантайм edge — как и у картинки итогов: на Node wasm-движки рендерера
 * роняют функцию ещё на импорте.
 *
 *   /api/og?title=…&subtitle=…&poster=…
 */
export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

const INK = "#050506";
const SURFACE = "#14141a";
const FOREGROUND = "#f3f3f6";
const ACCENT = "#ffb020";
const MUTED = "#9a9aa6";

/**
 * Постер приходится скачивать самим и отдавать рендереру строкой: ссылку на
 * чужой домен он подтягивает через раз — с Shikimori и AniList картинка
 * молча не появлялась, оставляя пустую колонку.
 *
 * Любая осечка — просто нет постера: карточка без него выглядит нормально,
 * а разворот ссылки в чате важнее украшений.
 */
async function loadPoster(url: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; TokiWaBot/1.0; +https://tokiwa.moe)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const type = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    // base64 вручную: Buffer на edge недоступен.
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Обрезаем: длинный заголовок ломает вёрстку, а в превью его всё равно
  // никто не дочитает.
  const title = (searchParams.get("title") ?? "TokiWa").slice(0, 70);
  const subtitle = (searchParams.get("subtitle") ?? "").slice(0, 120);
  const poster = searchParams.get("poster");

  const [medium, extraBold, posterData] = await Promise.all([
    fetch(new URL("/fonts/Manrope-Medium.ttf", request.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("/fonts/Manrope-ExtraBold.ttf", request.url)).then((r) => r.arrayBuffer()),
    loadPoster(poster),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          background: INK,
          fontFamily: "Manrope",
          color: FOREGROUND,
        }}
      >
        {/* Постер слева — если он есть, карточка сразу читается как «аниме».
            Рисуем только когда картинка действительно загрузилась: иначе
            останется пустая колонка, а текст съедет вбок. */}
        {posterData && (
          <div style={{ display: "flex", width: 420, height: HEIGHT, overflow: "hidden" }}>
            <img src={posterData} width={420} height={HEIGHT} style={{ objectFit: "cover" }} alt="" />
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: 64,
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            <span>TokiWa</span>
            {/* Точка вплотную к слову — у глифа свой отступ слева. */}
            <span style={{ marginLeft: -5, color: ACCENT }}>.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: title.length > 40 ? 54 : 68,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -2,
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div style={{ marginTop: 20, fontSize: 30, lineHeight: 1.3, color: MUTED }}>
                {subtitle}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", height: 4, width: 56, background: ACCENT }} />
            <div style={{ fontSize: 26, color: ACCENT }}>tokiwa.moe</div>
          </div>
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
      headers: {
        // Превью одинаковое для всех и меняется редко — пусть лежит в кэше
        // CDN, а не собирается на каждый разворот ссылки в чате.
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
