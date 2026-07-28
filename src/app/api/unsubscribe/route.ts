import { prisma } from "@/lib/prisma";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

/**
 * Отписка от писем о новых сериях. Работает без сессии — по подписанной
 * ссылке из письма. Ответ — простая страница, без редиректов и лишних
 * шагов: человек хотел отписаться, не надо его уговаривать.
 *
 * POST — для One-Click Unsubscribe из заголовка List-Unsubscribe-Post:
 * почтовые клиенты дёргают его сами, без открытия браузера.
 */

function page(title: string, text: string): Response {
  return new Response(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title} · TokiWa</title>
<style>body{background:#050506;color:#f3f3f6;font:16px/1.6 system-ui,sans-serif;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
main{max-width:28rem;padding:2rem;text-align:center}
h1{font-size:1.35rem;letter-spacing:-.02em}p{color:#9a9aa6}
a{color:#ffb020;text-decoration:none}</style></head>
<body><main><h1>${title}</h1><p>${text}</p>
<p><a href="/">← на TokiWa</a></p></main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

async function unsubscribe(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid") ?? "";
  const sig = searchParams.get("sig") ?? "";

  if (!uid || !sig || !verifyUnsubscribe(uid, sig)) {
    return page("Ссылка не сработала", "Похоже, она повреждена или устарела.");
  }

  // updateMany вместо update: не падаем, если пользователь уже удалён.
  await prisma.user.updateMany({
    where: { id: uid },
    data: { emailNotifications: false },
  });

  return page(
    "Готово, больше не побеспокоим",
    "Письма о новых сериях отключены. Передумаете — напишите нам через форму обратной связи.",
  );
}

export async function GET(request: Request) {
  return unsubscribe(request);
}

export async function POST(request: Request) {
  return unsubscribe(request);
}
