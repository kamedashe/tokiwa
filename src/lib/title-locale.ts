/**
 * Какое из названий показывать на каждом языке.
 *
 * В базе три варианта: `title` (английское или ромадзи из Jikan), `titleRu`
 * (Shikimori) и `titleJp` (оригинал). Украинских названий нет ни в одном
 * источнике — для украинской версии остаётся английское.
 */
export interface TitleNames {
  title: string;
  titleRu: string | null;
  titleJp: string | null;
}

export interface PickedTitle {
  /** Что показать крупно. */
  title: string;
  /** Что показать мелко второй строкой; null — дубликата не будет. */
  original: string | null;
}

export function pickTitle(t: TitleNames, locale: string): PickedTitle {
  if (locale === "ja" && t.titleJp) {
    return { title: t.titleJp, original: t.title };
  }

  if (locale === "ru" && t.titleRu) {
    return { title: t.titleRu, original: t.title };
  }

  // Английский и украинский идут на английском названии: для uk источника
  // переводов не существует, а дублировать оригинал под самим собой незачем.
  return { title: t.title, original: null };
}
