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
    date: "2026-08-24",
    ru: {
      title: "Поиск по смыслу",
      text: "Опишите словами, что хотите посмотреть: «грустная история про взросление», «тихое и уютное, чтобы отдохнуть». Ищет по смыслу, а не по названию, и понимает условия вроде «без гарема» или «из 2020-х». Вкладки «По названию» и «По смыслу» стоят над каталогом, и набранное переносится между ними.",
    },
    en: {
      title: "Search by meaning",
      text: "Describe what you are in the mood for: “a sad story about growing up”, “something quiet and cosy to unwind”. It searches by meaning rather than by title, and understands conditions like “no harem” or “from the 2020s”. The “By title” and “By meaning” tabs sit above the catalog, and your query moves between them.",
    },
    href: "/search",
  },
  {
    date: "2026-08-24",
    ru: {
      title: "Уведомления о новых сериях — без аккаунта",
      text: "Отметьте выходящий сериал как «смотрю» — и прямо там можно попросить прислать уведомление, когда выйдет серия. Приходит на устройство, даже если сайт закрыт. Регистрация не нужна: подписка живёт в браузере. На iPhone работает, если добавить TokiWa на экран «Домой».",
    },
    en: {
      title: "Episode alerts without an account",
      text: "Mark an airing show as “watching” and you can ask for a ping right there, for when the next episode drops. It arrives on your device even with the site closed. No sign-up needed — the subscription lives in your browser. On iPhone it works once TokiWa is added to the Home Screen.",
    },
  },
  {
    date: "2026-08-24",
    ru: {
      title: "Перенос списка с Shikimori и MyAnimeList",
      text: "Ник на Shikimori или файл выгрузки с MAL — и список переезжает вместе со статусами и прогрессом. Уже отмеченное не перезаписывается. Раньше кнопка пряталась внизу страницы, теперь её видно сразу.",
    },
    en: {
      title: "Bring your list from Shikimori or MyAnimeList",
      text: "Your Shikimori nickname or a MAL export file, and the list moves over with statuses and progress. Anything you have already marked stays as it is. The button used to hide at the bottom of the page — now you land on it.",
    },
    href: "/my",
  },
  {
    date: "2026-08-24",
    ru: {
      title: "Ссылки разворачиваются картинкой",
      text: "Кинули ссылку на тайтл в чат — вместо голого адреса появится карточка с постером, названием и полной длительностью.",
    },
    en: {
      title: "Links unfurl with a card",
      text: "Drop a title link into a chat and you get a card with the poster, the name and the total running time instead of a bare URL.",
    },
  },
  {
    date: "2026-08-23",
    ru: {
      title: "Уровни на странице итогов",
      text: "Часы просмотра теперь превращаются в уровень — от «Новичка» до «Легенды», — и показывают, сколько осталось до следующего. Рядом часы переведены в понятное: полнометражки, рабочие недели или месяцы подряд.",
    },
    en: {
      title: "Levels on your stats page",
      text: "Watched hours now turn into a level, from Novice to Legend, with progress to the next one. Next to it, hours are translated into something you can picture: feature films, work weeks or months straight.",
    },
    href: "/wrapped",
  },
  {
    date: "2026-08-23",
    ru: {
      title: "Список можно скачать файлом",
      text: "Кнопка «Скачать списком» на странице списка отдаёт таблицу со всеми тайтлами, статусами и прогрессом. Там же теперь видно, где список хранится: в браузере или в аккаунте.",
    },
    en: {
      title: "Download your list as a file",
      text: "The “Download as file” button on your list page gives you a table with every title, status and progress. The same line now shows where the list is kept: in this browser or in your account.",
    },
    href: "/my",
  },
  {
    date: "2026-08-23",
    ru: {
      title: "«Посмотрел» отмечает все серии сразу",
      text: "Раньше статус менялся, а счётчик серий оставался на месте — и время в бэклоге считалось так, будто тайтл недосмотрен.",
    },
    en: {
      title: "“Completed” now marks every episode",
      text: "The status used to change while the episode counter stayed put, so your backlog kept counting hours you had already watched.",
    },
  },
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
