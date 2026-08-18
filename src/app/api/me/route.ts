import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Кто смотрит страницу. Нужен, чтобы шапка узнавала пользователя из браузера,
 * а сами страницы могли отдаваться из кэша — раньше проверка сессии на сервере
 * делала динамическими вообще все страницы сайта.
 *
 * Ответ приватный: он про конкретного человека, и попасть в общий кэш не
 * должен ни при каких условиях.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { name: null, image: null, isSupporter: false, signedIn: false },
      { headers: { "cache-control": "private, no-store" } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, image: true, isSupporter: true },
  });

  return NextResponse.json(
    {
      name: user?.name ?? session.user.name ?? null,
      image: user?.image ?? session.user.image ?? null,
      isSupporter: user?.isSupporter ?? false,
      signedIn: true,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
