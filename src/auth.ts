import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Auth.js v5. Провайдер пока один — Discord: он заводится без ревью и без
 * страницы политики конфиденциальности. Google добавляется сюда же вторым
 * элементом массива, когда появится Privacy Policy.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Discord],

  // Сессии в БД, а не в JWT: нам всё равно ходить в базу за списками,
  // а так сессию можно отозвать, удалив строку.
  session: { strategy: "database" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
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
