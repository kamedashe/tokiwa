import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Auth.js v5. Два провайдера: Discord (попадание в аудиторию) и Google
 * (у него аккаунт есть у всех). Паролей нет намеренно — Credentials-провайдер
 * требует JWT-сессий, а мы держим сессии в БД, чтобы их можно было отзывать.
 *
 * `allowDangerousEmailAccountLinking` связывает входы с одинаковым email в один
 * аккаунт. Без него человек, зашедший сначала через Discord, а потом через
 * Google, упрётся в ошибку OAuthAccountNotLinked и не поймёт, что случилось.
 *
 * Флаг называется «dangerous», потому что провайдер с непроверенным email
 * позволил бы угнать чужой аккаунт. Google адрес всегда верифицирует, а для
 * Discord мы проверяем это сами в колбэке signIn ниже.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    Discord({ allowDangerousEmailAccountLinking: true }),
    Google({ allowDangerousEmailAccountLinking: true }),
  ],

  // Сессии в БД, а не в JWT: нам всё равно ходить в базу за списками,
  // а так сессию можно отозвать, удалив строку.
  session: { strategy: "database" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    /**
     * Не пускаем вход с неподтверждённым адресом. Иначе связывание по email
     * превращается в дыру: достаточно завести аккаунт с чужим адресом.
     */
    signIn({ account, profile }) {
      if (!profile) return true;

      if (account?.provider === "discord") {
        // Discord отдаёт verified в профиле; false — адрес не подтверждён.
        return (profile as { verified?: boolean }).verified !== false;
      }

      if (account?.provider === "google") {
        return (profile as { email_verified?: boolean }).email_verified !== false;
      }

      return true;
    },

    session({ session, user }) {
      // Прокидываем id и роль в сессию — по ним ищем списки и пускаем в админку.
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: string }).role ?? "user";
      }
      return session;
    },
  },

  events: {
    /**
     * Бутстрап админа: емейлы из ADMIN_EMAILS получают роль при первом входе.
     * Иначе первого админа назначить неоткуда — в свежей БД пользователей нет.
     */
    async signIn({ user }) {
      if (!user.email || !user.id) return;

      const admins = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (!admins.includes(user.email.toLowerCase())) return;

      await prisma.user.update({
        where: { id: user.id },
        data: { role: "admin" },
      });
    },
  },
});
