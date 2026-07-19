import Link from "next/link";

/**
 * Подвал. Нужен в основном ради ссылки на политику конфиденциальности —
 * Google требует, чтобы она была доступна с сайта, а не только из формы входа.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-hairline px-4 py-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-dim">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Политика конфиденциальности
          </Link>
          <Link href="/catalog" className="transition-colors hover:text-foreground">
            Каталог
          </Link>
        </div>

        <p className="max-w-[46ch] leading-relaxed">
          Данные об аниме — из открытых источников: MyAnimeList, Shikimori, AniList. Видео мы не
          храним и не раздаём.
        </p>
      </div>
    </footer>
  );
}
