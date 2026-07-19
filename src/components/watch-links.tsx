import { SERVICES, isAvailableIn } from "@/lib/services";
import { affiliateUrl } from "@/lib/affiliate";

export interface WatchLinkRow {
  id: number;
  service: string;
  url: string;
  note: string | null;
}

/**
 * «Где посмотреть» — легальные сервисы, которые не дают встраивать себя в
 * чужой сайт. Уводим наружу, в новую вкладку.
 *
 * Сервисы, недоступные в стране посетителя, не прячем совсем, а опускаем вниз
 * под отдельный заголовок: у людей бывают VPN и подписки других регионов.
 */
export function WatchLinks({
  links,
  country,
}: {
  links: WatchLinkRow[];
  /** Код страны из geo-заголовка. null — не определили. */
  country?: string | null;
}) {
  if (links.length === 0) return null;

  const local = links.filter((l) => isAvailableIn(l.service, country ?? null));
  const foreign = links.filter((l) => !isAvailableIn(l.service, country ?? null));

  return (
    <div className="flex flex-col gap-5">
      <LinkGroup links={local} />

      {foreign.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-display text-[11px] tracking-[0.16em] text-dim">
            МОЖЕТ НЕ РАБОТАТЬ В ВАШЕЙ СТРАНЕ
          </span>
          <LinkGroup links={foreign} muted />
        </div>
      )}
    </div>
  );
}

function LinkGroup({ links, muted = false }: { links: WatchLinkRow[]; muted?: boolean }) {
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-3 ${muted ? "opacity-60" : ""}`}>
      {links.map((link) => {
        const info = SERVICES[link.service];
        if (!info) return null;

        const { url, sponsored } = affiliateUrl(link.service, link.url);

        return (
          <a
            key={link.id}
            href={url}
            target="_blank"
            // sponsored обязателен для партнёрских ссылок по правилам поисковиков;
            // noreferrer заодно закрывает доступ к window.opener.
            rel={
              sponsored ? "nofollow sponsored noopener noreferrer" : "noopener noreferrer"
            }
            className="group flex items-center gap-3 rounded-xl border border-hairline bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: info.color }}
              aria-hidden
            />
            <span className="flex flex-col">
              <span className="font-display text-[14px] font-semibold">{info.label}</span>
              <span className="flex items-center gap-1.5">
                {link.note && <span className="text-[11px] text-dim">{link.note}</span>}
                {sponsored && (
                  // Партнёрские ссылки положено помечать явно.
                  <span className="text-[10px] uppercase tracking-[0.1em] text-faint">
                    реклама
                  </span>
                )}
              </span>
            </span>
            <span className="ml-1 text-[13px] text-dim transition-colors group-hover:text-accent">
              ↗
            </span>
          </a>
        );
      })}
    </div>
  );
}
