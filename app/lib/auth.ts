import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // Create or update user in database
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existingUser.length === 0) {
        // Create new user
        await db.insert(users).values({
          email: user.email,
          name: user.name || null,
          image: user.image || null,
          emailVerified: new Date(),
        });
      } else {
        // Update existing user
        await db
          .update(users)
          .set({
            name: user.name || null,
            image: user.image || null,
            updatedAt: new Date(),
          })
          .where(eq(users.email, user.email));
      }

      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Get user from database to include id
        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.email, session.user.email!))
          .limit(1);

        if (dbUser.length > 0) {
          session.user.id = dbUser[0].id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};

