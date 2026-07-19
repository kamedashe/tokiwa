import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  /**
   * Пропускаем через локализацию только страницы. Ручки API, статику Next и
   * файлы с расширением трогать нельзя — иначе `/api/auth/...` уедет на
   * `/ru/api/auth/...` и сломает OAuth.
   */
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
