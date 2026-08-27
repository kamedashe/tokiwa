"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { UserMenuDropdown } from "@/components/user-menu-dropdown";
import { signOutAction } from "@/lib/auth-actions";

interface Viewer {
  /** Единственный надёжный признак: имя и аватар бывают пустыми и у вошедших. */
  signedIn: boolean;
  name: string | null;
  image: string | null;
  isSupporter: boolean;
}

/**
 * Меню профиля, узнающее пользователя уже в браузере.
 *
 * Раньше оно спрашивало сессию на сервере, и поскольку шапка есть на каждой
 * странице, весь сайт приходилось рендерить заново на каждый запрос — включая
 * обходы роботов. Один такой обход каталога на четырёх языках сжёг месячную
 * квоту базы. Теперь публичные страницы отдаются из кэша, а кто их смотрит,
 * выясняется отдельным лёгким запросом; роботы его вовсе не делают, потому
 * что не исполняют скрипты.
 *
 * Пока ответ не пришёл, показываем кнопку входа: гостей большинство, и для
 * них это сразу верное состояние, а не мигание заглушкой.
 */
export function UserMenuClient({
  donateUrl,
  labels,
}: {
  donateUrl: string | null;
  labels: {
    signIn: string;
    myList: string;
    backlog: string;
    wrapped: string;
    feedback: string;
    support: string;
    supporterBadge: string;
    signOut: string;
  };
}) {
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Viewer | null) => {
        // Смотрим именно на signedIn. Раньше здесь стояла проверка на имя, но
        // гостю приходит name: null, а null !== undefined — правда, поэтому
        // меню профиля показывалось всем подряд: вошедшим и нет. Кнопку
        // «Войти» на сайте из-за этого не видел никто, а «Выйти» у гостя
        // ничего не делала — выходить было не из чего.
        if (!cancelled && data?.signedIn) setViewer(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (!viewer) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-accent px-5 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft"
      >
        {labels.signIn}
      </Link>
    );
  }

  return (
    <UserMenuDropdown
      name={viewer.name}
      image={viewer.image}
      donateUrl={donateUrl}
      isSupporter={viewer.isSupporter}
      labels={labels}
      signOutAction={signOutAction}
    />
  );
}
