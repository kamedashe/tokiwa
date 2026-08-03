/**
 * Журнал обновлений сайта — источник страницы «Что нового».
 *
 * Записи ведутся руками: сюда попадает только то, что заметит пользователь,
 * а не каждый коммит. Новые — сверху. Тексты на двух языках: украинская
 * локаль читает русский, японская — английский; для журнала этого достаточно,
 * а поддерживать четыре перевода руками — верный способ его забросить.
 *
 * Дата последней записи заодно питает точку-индикатор в шапке: она сравнится
 * с меткой «когда человек последний раз открывал журнал» в localStorage.
 */

export interface ChangelogEntry {
  /** ISO-дата — ключ записи и опора индикатора «есть непрочитанное». */
  date: string;
  ru: { title: string; text: string };
  en: { title: string; text: string };
  /** Куда ведёт «попробовать» — если фичу можно пощупать сразу. */
  href?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-08-03",
    ru: {
      title: "TokiWa ставится как приложение",
      text: "Откройте сайт с телефона и выберите «Установить приложение» (Android) или «На экран „Домой“» (iPhone) — иконка на рабочем столе, полный экран, без адресной строки.",
    },
    en: {
      title: "TokiWa installs like an app",
      text: "Open the site on your phone and pick “Install app” (Android) or “Add to Home Screen” (iPhone) — an icon on your home screen, full screen, no address bar.",
    },
  },
  {
    date: "2026-08-03",
    ru: {
      title: "Календарь серий",
      text: "Расписание на неделю вперёд по дням: что выходит, во сколько и какая серия. Тайтлы из вашего списка помечены.",
    },
    en: {
      title: "Episode calendar",
      text: "A week ahead, day by day: what airs, when, and which episode. Titles from your list are marked.",
    },
    href: "/calendar",
  },
  {
    date: "2026-08-03",
    ru: {
      title: "Недельный дайджест на почту",
      text: "Раз в неделю, воскресным вечером: какие серии выходят, что из планов уже началось и сколько часов в бэклоге. Отписка в один клик.",
    },
    en: {
      title: "Weekly email digest",
      text: "Once a week, Sunday evening: which episodes air, what from your plans has started, and how many hours your backlog holds. One-click unsubscribe.",
    },
  },
  {
    date: "2026-07-30",
    ru: {
      title: "Сетка серий на странице тайтла",
      text: "Клик по номеру отмечает всё до этой серии — перенести историю «Блича» теперь пара кликов, а не 366. Повторный клик по последней отмеченной снимает её.",
    },
    en: {
      title: "Episode grid on title pages",
      text: "Click a number to mark everything up to that episode — porting your Bleach history is now two clicks, not 366. Click the last marked one again to undo it.",
    },
  },
  {
    date: "2026-07-30",
    ru: {
      title: "Подборки по настроению",
      text: "«Лёгкое», «Весёлое», «Стеклище», «Романтика», «Напряжение», «Подумать» — когда выбираешь не по жанру, а по состоянию души.",
    },
    en: {
      title: "Mood collections",
      text: "Easy watch, Funny, Tearjerker, Romance, On edge, Makes you think — for when you pick by state of mind, not genre.",
    },
    href: "/mood/light",
  },
  {
    date: "2026-07-30",
    ru: {
      title: "Франшиза и похожее — рядом с тайтлом",
      text: "Под каждым тайтлом теперь его сезоны, фильмы и побочки, а следом похожее по жанрам. Досмотрел — сразу видно, куда дальше.",
    },
    en: {
      title: "Franchise and similar titles nearby",
      text: "Every title page now lists its seasons, movies and spin-offs, followed by similar shows. Finished one? The next step is right there.",
    },
  },
  {
    date: "2026-07-30",
    ru: {
      title: "«+1» прямо на карточке",
      text: "Отметить серию можно из «Продолжить просмотр» и из своего списка — одним кликом, не открывая страницу тайтла.",
    },
    en: {
      title: "“+1” right on the card",
      text: "Mark an episode from Continue Watching or your list — one click, without opening the title page.",
    },
    href: "/my",
  },
  {
    date: "2026-07-28",
    ru: {
      title: "Уведомления о новых сериях — на почту",
      text: "Вышла серия тайтла из вашего «смотрю» — приходит письмо: какие серии, сколько догонять. Привязан Telegram-бот — придёт в него. Отписка в один клик.",
    },
    en: {
      title: "New-episode notifications by email",
      text: "When an episode of something you're watching airs, you get an email: which episodes, how long to catch up. Linked the Telegram bot? It goes there instead. One-click unsubscribe.",
    },
  },
  {
    date: "2026-07-28",
    ru: {
      title: "Считать можно без регистрации",
      text: "Списки, статусы, прогресс и вся математика времени работают сразу, гостем. Аккаунт нужен, только чтобы список не потерялся и приходили уведомления — при входе гостевой список переезжает сам.",
    },
    en: {
      title: "No account needed to count",
      text: "Lists, statuses, progress and all the time math work right away, as a guest. An account is only for keeping the list safe and getting notifications — it merges automatically when you sign in.",
    },
    href: "/backlog",
  },
];

/** Дата свежайшей записи — для точки-индикатора в шапке. */
export const LATEST_UPDATE = CHANGELOG[0].date;

/** Русский текст читают ru и uk, английский — en и ja. */
export function changelogLocale(locale: string): "ru" | "en" {
  return locale === "ru" || locale === "uk" ? "ru" : "en";
}
