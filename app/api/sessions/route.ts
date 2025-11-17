import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/db";
import { sessions, messages } from "@/app/db/schema";
import { eq, desc } from "drizzle-orm";
import { decrypt } from "@/app/lib/encryption";

// GET - Load all sessions for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch sessions with their messages
    const userSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, session.user.id))
      .orderBy(desc(sessions.updatedAt));

    // Load messages for each session
    const sessionsWithMessages = await Promise.all(
      userSessions.map(async (sess) => {
        const sessionMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.sessionId, sess.id))
          .orderBy(messages.createdAt);

        // Decrypt messages
        const decryptedMessages = sessionMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: decrypt(msg.contentEncrypted, session.user!.id),
          createdAt: msg.createdAt,
        }));

        return {
          id: sess.id,
          title: sess.title,
          messages: decryptedMessages,
          createdAt: sess.createdAt,
          updatedAt: sess.updatedAt,
        };
      })
    );

    return NextResponse.json({ sessions: sessionsWithMessages });
  } catch (error) {
    console.error("Failed to load sessions:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

// POST - Create new session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title = "New Chat" } = body;

    const [newSession] = await db
      .insert(sessions)
      .values({
        userId: session.user.id,
        title,
      })
      .returning();

    return NextResponse.json({
      session: {
        id: newSession.id,
        title: newSession.title,
        messages: [],
        createdAt: newSession.createdAt,
        updatedAt: newSession.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

