import { NextResponse } from "next/server";
import {
  markHomepagePicks,
  syncCatalog,
  syncCatalogFromShikimoriCron,
  syncOngoingEpisodes,
  syncRelated,
} from "@/lib/sync";

// Прогон ходит во внешние API и упирается в их задержки. 60 секунд — потолок
// бесплатного тарифа Vercel; проходы инкрементальные и в него укладываются.
export const maxDuration = 60;

/**
 * Ручку дёргают двумя способами, и у каждого свой секрет:
 *
 * - вручную: POST с `Bearer SYNC_SECRET`;
 * - кроном Vercel: GET с `Bearer CRON_SECRET` — заголовок платформа
 *   подставляет сама, если переменная задана в окружении проекта.
 *
 * Без проверки любой прохожий сможет выжечь наш лимит к Jikan.
 */
function authorize(request: Request): { ok: true } | { ok: false; response: NextResponse } {
  const header = request.headers.get("authorization");

  const secrets = [process.env.SYNC_SECRET, process.env.CRON_SECRET].filter(Boolean);

  if (secrets.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Не задан ни SYNC_SECRET, ни CRON_SECRET" },
        { status: 500 },
      ),
    };
  }

  if (!secrets.some((s) => header === `Bearer ${s}`)) {
    return { ok: false, response: NextResponse.json({ error: "Нет доступа" }, { status: 401 }) };
  }

  return { ok: true };
}

async function run(request: Request) {
  const startedAt = Date.now();
  const auth = authorize(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const pages = Math.min(4, Math.max(1, Number(searchParams.get("pages")) || 1));

  // ?mode=related достраивает франшизы, ?mode=shikimori наполняет каталог
  // дальше по популярности, продолжая с прошлой страницы.
  const mode = searchParams.get("mode");

  try {
    if (mode === "related") {
      const result = await syncRelated({ seeds: 10, limit: 20 });

      // Остаток бюджета — онгоингам: вместе со вторым кроном выходит два
      // освежения серий в сутки.
      const left = maxDuration * 1000 - (Date.now() - startedAt) - 5_000;
      const ongoing = left > 5_000 ? await syncOngoingEpisodes({ budgetMs: left }) : null;

      await markHomepagePicks();
      return NextResponse.json({
        ok: true,
        mode,
        ...result,
        ongoingUpdated: ongoing?.updated ?? 0,
      });
    }

    if (mode === "shikimori") {
      const result = await syncCatalogFromShikimoriCron();
      await markHomepagePicks();
      return NextResponse.json({ ok: true, mode, ...result });
    }

    // Точечное обновление онгоингов — для ручных прогонов.
    if (mode === "ongoing") {
      const result = await syncOngoingEpisodes({ budgetMs: 50_000 });
      return NextResponse.json({ ok: true, mode, ...result });
    }

    // Порядок важен. Первыми идут онгоинги: «вышла новая серия» — то, ради
    // чего пользователи возвращаются, и эта свежесть дороже добора каталога.
    // Затем Shikimori — он предсказуемо быстрый и гарантированно что-то
    // добавит. Jikan нужен только ради свежего сезона, но то отвечает бодро,
    // то уходит в ретраи — ему достаётся остаток бюджета.
    const ongoing = await syncOngoingEpisodes({ budgetMs: 20_000 });
    const shikimori = await syncCatalogFromShikimoriCron({ budgetMs: 15_000 });

    const left = maxDuration * 1000 - (Date.now() - startedAt) - 5_000;
    const synced = left > 5_000 ? await syncCatalog({ pages, budgetMs: left }) : 0;

    await markHomepagePicks();

    return NextResponse.json({
      ok: true,
      mode: "catalog",
      synced,
      ongoingUpdated: ongoing.updated,
      shikimoriAdded: shikimori.added,
      nextPage: shikimori.nextPage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

/** Ручной запуск. */
export const POST = run;

/** Вызов от Vercel Cron — он умеет только GET. */
export const GET = run;
