import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";

export const metadata = {
  title: "Политика конфиденциальности",
  description: "Какие данные собирает TokiWa и что с ними происходит.",
};

/**
 * Обязательна для Google OAuth: без ссылки на неё приложение не выйдет из
 * режима Testing со лимитом в 100 пользователей.
 *
 * Дата обновления не хардкодится — иначе однажды забудешь и она протухнет.
 * Меняется только при правках самого текста.
 */
const UPDATED = "19 июля 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      <article className="mx-auto max-w-[70ch] px-4 py-10 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">
          Политика конфиденциальности
        </h1>
        <p className="mt-2 text-[13px] text-dim">Обновлено {UPDATED}</p>

        <p className="mt-6 leading-relaxed text-muted">
          TokiWa — трекер просмотра аниме. Сервис некоммерческий и сделан как учебный проект.
          Ниже честно и без юридического тумана описано, какие данные собираются и зачем.
        </p>

        <Section title="Что собираем">
          <p>
            При входе через Google или Discord мы получаем от них{" "}
            <strong className="text-foreground">имя, адрес электронной почты и аватар</strong>.
            Больше ничего: доступа к вашим письмам, контактам, серверам Discord или файлам у нас
            нет и не запрашивается.
          </p>
          <p>
            Дополнительно храним то, что вы создаёте сами: списки аниме, статусы просмотра и номер
            серии, на которой остановились.
          </p>
        </Section>

        <Section title="Зачем это нужно">
          <p>
            Почта и имя — чтобы узнавать вас при следующем входе и связывать список именно с вашим
            аккаунтом. Аватар — чтобы показать его в углу экрана. Списки и прогресс — собственно
            ради них сервис и существует.
          </p>
          <p>
            Мы не используем эти данные для рекламы, не строим на их основе профили и не
            анализируем ваше поведение.
          </p>
        </Section>

        <Section title="Кому передаём">
          <p>
            <strong className="text-foreground">Никому.</strong> Данные не продаются, не
            передаются третьим лицам и не публикуются. Ваш список виден только вам.
          </p>
          <p>
            Технически данные лежат в базе PostgreSQL и на хостинге, где работает сайт. Эти
            поставщики имеют к ним доступ на общих основаниях, как любой хостинг.
          </p>
        </Section>

        <Section title="Внешние сервисы">
          <p>
            Описания и обложки аниме подгружаются из открытых источников — Jikan (MyAnimeList),
            Shikimori и AniList. Им не передаётся ничего о вас: запросы уходят с нашего сервера,
            а результат кэшируется у нас.
          </p>
          <p>
            Ссылки «Где посмотреть» ведут на сторонние сервисы. Часть из них — партнёрские, они
            помечены словом «реклама». Переходя по такой ссылке, вы попадаете на чужой сайт, где
            действует его собственная политика.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Используется одна техническая cookie — она хранит вашу сессию, чтобы не приходилось
            входить заново при каждом открытии сайта. Рекламных и аналитических cookie нет.
          </p>
        </Section>

        <Section title="Удаление данных">
          <p>
            Напишите на{" "}
            <a href="mailto:jokuujiop42@gmail.com" className="text-accent hover:text-accent-soft">
              jokuujiop42@gmail.com
            </a>{" "}
            — аккаунт и всё, что с ним связано, будет удалено. Удаление аккаунта каскадом уносит
            списки, прогресс и сохранённые сессии, ничего не остаётся.
          </p>
          <p>
            Отозвать доступ можно и со стороны провайдера: в настройках безопасности Google или
            Discord, в разделе подключённых приложений.
          </p>
        </Section>

        <Section title="Изменения">
          <p>
            Если политика поменяется, здесь обновится дата вверху страницы. О существенных
            изменениях предупредим на самом сайте.
          </p>
        </Section>

        <div className="mt-10 border-t border-hairline pt-6">
          <Link href="/" className="text-[14px] text-accent hover:text-accent-soft">
            ← На главную
          </Link>
        </div>
      </article>

      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}
