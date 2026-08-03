import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { sendEmail, emailEnabled } from "@/lib/email";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { remainingMinutes, totalMinutes } from "@/lib/backlog";

/**
 * Недельный дайджест — письмо, у которого есть что сказать каждому.
 *
 * Уведомления о сериях достают только до тех, у кого в «смотрю» лежит
 * онгоинг, — это ~четверть базы. Дайджест закрывает остальных: если на
 * неделе выходят серии — о них; если из «запланировано» что-то уже начало
 * выходить — подскажем; если и этого нет — честные цифры бэклога и пара
 * коротких тайтлов «закрыть за вечер».
 *
 * Шлётся воскресным вечерним кроном; хвост, не влезший в бюджет, доходит
 * утром понедельника — антидубль на digestSentAt.
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tagged(path: string): string {
  return `${SITE_URL}${path}?utm_source=email&utm_medium=digest&utm_campaign=weekly`;
}

const WEEK_MS = 7 * 86_400_000;

interface DigestData {
  /** Серии на предстоящей неделе: тайтл + дата. */
  upcoming: { slug: string; name: string; at: Date }[];
  /** «Смотрю» с непросмотренными сериями: сколько догонять. */
  behind: { slug: string; name: string; count: number; minutes: number }[];
  /** «Запланировано», которое уже начало выходить. */
  started: { slug: string; name: string; aired: number }[];
  /** Фолбэк: часы бэклога и короткие тайтлы на вечер. */
  backlogMinutes: number;
  quickPicks: { slug: string; name: string; minutes: number }[];
}

async function collect(userId: string): Promise<DigestData | null> {
  const entries = await prisma.watchlistEntry.findMany({
    where: { userId, status: { in: ["watching", "planned"] } },
    select: {
      status: true,
      progress: true,
      title: {
        select: {
          slug: true,
          title: true,
          titleRu: true,
          status: true,
          score: true,
          format: true,
          episodesAired: true,
          episodesCount: true,
          durationMin: true,
          nextEpisodeAt: true,
        },
      },
    },
  });
  if (entries.length === 0) return null;

  const now = Date.now();
  const name = (t: { titleRu: string | null; title: string }) => t.titleRu ?? t.title;

  const upcoming = entries
    .filter((e) => {
      const at = e.title.nextEpisodeAt?.getTime();
      return e.title.status === "releasing" && at && at > now && at < now + WEEK_MS;
    })
    .map((e) => ({ slug: e.title.slug, name: name(e.title), at: e.title.nextEpisodeAt! }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 6);

  const behind = entries
    .filter(
      (e) =>
        e.status === "watching" &&
        e.title.status === "releasing" &&
        (e.title.episodesAired ?? 0) > e.progress,
    )
    .map((e) => {
      const count = e.title.episodesAired! - e.progress;
      return {
        slug: e.title.slug,
        name: name(e.title),
        count,
        minutes: count * (e.title.durationMin ?? 24),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const started = entries
    .filter(
      (e) =>
        e.status === "planned" &&
        e.title.status === "releasing" &&
        (e.title.episodesAired ?? 0) > 0,
    )
    .map((e) => ({ slug: e.title.slug, name: name(e.title), aired: e.title.episodesAired! }))
    .sort((a, b) => a.aired - b.aired)
    .slice(0, 4);

  const backlogMinutes = entries.reduce(
    (sum, e) =>
      sum + (e.status === "watching" ? remainingMinutes(e.title, e.progress) : totalMinutes(e.title)),
    0,
  );

  const quickPicks = entries
    .filter((e) => e.status === "planned" && totalMinutes(e.title) <= 150)
    .sort((a, b) => (b.title.score ?? 0) - (a.title.score ?? 0))
    .slice(0, 3)
    .map((e) => ({ slug: e.title.slug, name: name(e.title), minutes: totalMinutes(e.title) }));

  return { upcoming, behind, started, backlogMinutes, quickPicks };
}

const fmtDay = new Intl.DateTimeFormat("ru", { weekday: "short", day: "numeric", month: "long" });

function row(inner: string): string {
  return `<tr><td style="padding:8px 0;border-bottom:1px solid #26262e">${inner}</td></tr>`;
}

function link(href: string, text: string): string {
  return `<a href="${href}" style="color:#f3f3f6;font-weight:600;text-decoration:none">${escapeHtml(text)}</a>`;
}

function section(label: string, rows: string): string {
  if (!rows) return "";
  return `<tr><td style="color:#ffb020;font-size:13px;letter-spacing:2px;padding:18px 0 2px">${label}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

function buildEmail(d: DigestData, unsub: string): { subject: string; html: string } {
  const hours = Math.round(d.backlogMinutes / 60);

  const subject =
    d.upcoming.length > 0
      ? `На этой неделе — серии ${d.upcoming.length === 1 ? "вашего тайтла" : `${d.upcoming.length} ваших тайтлов`}`
      : d.behind.length > 0
        ? `Вас ждут непросмотренные серии`
        : d.started.length > 0
          ? `Из ваших планов уже что-то выходит`
          : `Ваш бэклог — ${hours} ч. Вот что закрыть за вечер`;

  const upcomingRows = d.upcoming
    .map((u) =>
      row(
        `${link(tagged(`/anime/${u.slug}`), u.name)}
         <div style="color:#9a9aa6;font-size:13px;margin-top:2px">${fmtDay.format(u.at)}</div>`,
      ),
    )
    .join("");

  const behindRows = d.behind
    .map((b) =>
      row(
        `${link(tagged(`/anime/${b.slug}`), b.name)}
         <div style="color:#9a9aa6;font-size:13px;margin-top:2px">ждут ${b.count} сер. · догнать ≈ ${b.minutes} мин</div>`,
      ),
    )
    .join("");

  const startedRows = d.started
    .map((s) =>
      row(
        `${link(tagged(`/anime/${s.slug}`), s.name)}
         <div style="color:#9a9aa6;font-size:13px;margin-top:2px">у вас в планах · уже вышло ${s.aired} сер.</div>`,
      ),
    )
    .join("");

  const picksRows = d.quickPicks
    .map((p) =>
      row(
        `${link(tagged(`/anime/${p.slug}`), p.name)}
         <div style="color:#9a9aa6;font-size:13px;margin-top:2px">≈ ${p.minutes} мин — влезет в один вечер</div>`,
      ),
    )
    .join("");

  // Фолбэк-секции показываем, только когда нет «живых» — иначе письмо пухнет.
  const hasLive = d.upcoming.length > 0 || d.behind.length > 0 || d.started.length > 0;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#050506">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050506">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;font-family:system-ui,-apple-system,sans-serif">
  <tr><td style="color:#f3f3f6;font-size:20px;font-weight:800;padding-bottom:2px">
    TokiWa<span style="color:#ffb020">.</span>
  </td></tr>
  <tr><td style="color:#5c5c66;font-size:12px">ваша неделя в аниме</td></tr>
  ${section("ВЫХОДЯТ НА ЭТОЙ НЕДЕЛЕ", upcomingRows)}
  ${section("ЖДУТ ВАС", behindRows)}
  ${section("ИЗ ПЛАНОВ УЖЕ ВЫХОДИТ", startedRows)}
  ${
    hasLive
      ? ""
      : `<tr><td style="color:#f3f3f6;font-size:15px;padding:18px 0 2px">
           В вашем списке — <b style="color:#ffb020">${hours} ч</b> непросмотренного.
         </td></tr>${section("ЗАКРОЕТСЯ ЗА ВЕЧЕР", picksRows)}`
  }
  <tr><td align="center" style="padding:24px 0">
    <a href="${tagged("/my")}" style="display:inline-block;background:#ffb020;color:#050506;font-weight:700;font-size:14px;text-decoration:none;padding:10px 24px;border-radius:999px">Открыть мой список</a>
  </td></tr>
  <tr><td style="color:#5c5c66;font-size:12px;padding-top:8px;border-top:1px solid #26262e">
    Дайджест приходит раз в неделю. <a href="${unsub}" style="color:#9a9aa6">Отписаться от писем</a>
  </td></tr>
</table>
</td></tr></table></body></html>`;

  return { subject, html };
}

export async function sendWeeklyDigests({ budgetMs = 15_000 }: { budgetMs?: number } = {}) {
  if (!emailEnabled()) return { sent: 0, skipped: "disabled" as const };

  const deadline = Date.now() + budgetMs;
  const weekAgo = new Date(Date.now() - 6 * 86_400_000);

  const users = await prisma.user.findMany({
    where: {
      isGuest: false,
      email: { not: null },
      emailNotifications: true,
      OR: [{ digestSentAt: null }, { digestSentAt: { lt: weekAgo } }],
      watchlist: { some: { status: { in: ["watching", "planned"] } } },
    },
    select: { id: true, email: true },
  });

  let sent = 0;

  for (const user of users) {
    if (Date.now() > deadline) break;

    const data = await collect(user.id);
    if (!data) continue;

    const { subject, html } = buildEmail(data, unsubscribeUrl(user.id));
    const ok = await sendEmail({
      to: user.email!,
      subject,
      html,
      unsubscribeUrl: unsubscribeUrl(user.id),
    });

    if (ok) {
      sent++;
      await prisma.user.update({ where: { id: user.id }, data: { digestSentAt: new Date() } });
      // Пауза под лимит Resend — 2 письма в секунду.
      await new Promise((r) => setTimeout(r, 550));
    }
  }

  return { sent, pending: users.length - sent };
}

/** Окно рассылки: воскресный вечер плюс понедельничное утро для хвоста. */
export function isDigestWindow(now = new Date()): boolean {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  return (day === 0 && hour >= 12) || (day === 1 && hour < 12);
}

/** Тест: собрать и отправить дайджест пользователя на его же адрес. */
export async function sendTestDigest(to: string): Promise<boolean> {
  const user = await prisma.user.findFirst({ where: { email: to }, select: { id: true } });
  if (!user) return false;

  const data = await collect(user.id);
  if (!data) return false;

  const { subject, html } = buildEmail(data, unsubscribeUrl(user.id));
  return sendEmail({ to, subject: `[тест] ${subject}`, html, unsubscribeUrl: unsubscribeUrl(user.id) });
}
