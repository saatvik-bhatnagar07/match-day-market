import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      const allowedDomain = process.env.ALLOWED_DOMAIN;
      if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
        return false;
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, balance: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          (session as any).balance = dbUser.balance;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) =>
    e.trim()
  );
  return adminEmails?.includes(email) ?? false;
}

export async function getRequiredSession() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getRequiredAdmin() {
  const session = await getRequiredSession();
  if (!isAdmin(session.user?.email)) {
    throw new Error("Forbidden");
  }
  return session;
}
