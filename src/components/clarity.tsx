import Script from "next/script";

/**
 * Microsoft Clarity — записи сессий и карты кликов. Нужен ровно для одного
 * вопроса, на который цифры не отвечают: что человек делает перед тем, как
 * уйти, и где спотыкается. Аналитика Vercel показывает «сколько», Clarity —
 * «почему».
 *
 * Без NEXT_PUBLIC_CLARITY_ID ничего не подключается: локальная разработка не
 * должна засорять записи, да и лишний скрипт на странице ни к чему.
 *
 * Скрипт грузится после интерактивности страницы, чтобы не влиять на скорость,
 * а поля ввода Clarity маскирует на своей стороне по умолчанию.
 */
export function Clarity() {
  const id = process.env.NEXT_PUBLIC_CLARITY_ID;
  if (!id) return null;

  return (
    <Script id="clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${id}");`}
    </Script>
  );
}
