import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  /**
   * Пропускаем через локализацию только страницы. Ручки API, статику Next и
   * файлы с расширением трогать нельзя — иначе `/api/auth/...` уедет на
   * `/ru/api/auth/...` и сломает OAuth.
   *
   * Адреса-метки (tt/yt/ig/tg, см. lib/traffic-mark.ts) тоже мимо: это
   * редиректы без языка, а локализация переписала бы их в `/ru/tt` → 404.
   */
  matcher: ["/((?!api|_next|_vercel|tt|yt|ig|tg|.*\\..*).*)"],
};
