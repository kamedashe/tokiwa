/**
 * Легальные сервисы, куда уводим смотреть. Список закрытый: админ выбирает
 * сервис, а не вбивает произвольный хост — так пиратская ссылка сюда не
 * попадёт даже по невнимательности.
 */
export interface ServiceInfo {
  label: string;
  hosts: string[];
  /** Акцент для кнопки — цвет бренда. */
  color: string;
  /** Коды стран, где сервис реально работает. "*" — везде. */
  regions: string[];
}

export const SERVICES: Record<string, ServiceInfo> = {
  // Россия
  kinopoisk: { label: "Кинопоиск", hosts: ["kinopoisk.ru"], color: "#ff6122", regions: ["RU"] },
  okko: { label: "Okko", hosts: ["okko.tv"], color: "#7c4dff", regions: ["RU"] },
  wink: { label: "Wink", hosts: ["wink.ru"], color: "#9a4dff", regions: ["RU"] },
  ivi: { label: "Иви", hosts: ["ivi.ru"], color: "#ff2d78", regions: ["RU"] },
  start: { label: "START", hosts: ["start.ru"], color: "#ff3b30", regions: ["RU"] },
  premier: { label: "PREMIER", hosts: ["premier.one"], color: "#00b2ff", regions: ["RU"] },

  // Украина
  megogo: { label: "MEGOGO", hosts: ["megogo.net", "megogo.ua"], color: "#ff6b00", regions: ["UA"] },
  sweettv: { label: "sweet.tv", hosts: ["sweet.tv"], color: "#ff4081", regions: ["UA"] },
  kyivstartv: { label: "Київстар ТБ", hosts: ["kyivstar.tv"], color: "#00a9e0", regions: ["UA"] },
  youtv: { label: "youtv", hosts: ["youtv.com.ua"], color: "#e91e63", regions: ["UA"] },

  // Работают в обеих странах (Crunchyroll в РФ недоступен, в UA — с оговорками)
  netflix: { label: "Netflix", hosts: ["netflix.com"], color: "#e50914", regions: ["*"] },
  crunchyroll: {
    label: "Crunchyroll",
    hosts: ["crunchyroll.com"],
    color: "#f47521",
    regions: ["*"],
  },
};

export const SERVICE_KEYS = Object.keys(SERVICES);

export function isServiceKey(value: string): boolean {
  return value in SERVICES;
}

/** Сервис доступен в стране посетителя? Неизвестная страна — показываем всё. */
export function isAvailableIn(service: string, country: string | null): boolean {
  const info = SERVICES[service];
  if (!info || !country) return true;
  return info.regions.includes("*") || info.regions.includes(country);
}

export interface LinkCheck {
  ok: boolean;
  error?: string;
}

/**
 * Ссылка должна вести именно на выбранный сервис. Это не iframe, выполнения
 * тут нет, но https всё равно обязателен, а хост сверяем со списком сервиса —
 * иначе «Кинопоиск» мог бы вести куда угодно.
 */
export function checkWatchLink(service: string, raw: string): LinkCheck {
  const info = SERVICES[service];
  if (!info) return { ok: false, error: "Неизвестный сервис" };

  const value = raw.trim();
  if (!value) return { ok: false, error: "Ссылка пустая" };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Не похоже на URL — нужен полный адрес со схемой" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "Только https" };
  }

  const host = url.hostname.toLowerCase();
  const matches = info.hosts.some((h) => host === h || host.endsWith(`.${h}`));

  if (!matches) {
    return {
      ok: false,
      error: `Для «${info.label}» ожидается ссылка на ${info.hosts.join(" или ")}, а не на ${host}`,
    };
  }

  return { ok: true };
}
