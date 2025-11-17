import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/db";
import { sessions, messages } from "@/app/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt } from "@/app/lib/encryption";

// POST - Save message to session
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await context.params;
    const body = await request.json();
    const { role, content } = body;

    console.log(`Saving message to session ${sessionId}:`, { role, contentLength: content?.length });

    if (!role || !content) {
      return NextResponse.json(
        { error: "Role and content are required" },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const sessionExists = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, session.user.id)))
      .limit(1);

    if (sessionExists.length === 0) {
      console.error(`Session ${sessionId} not found for user ${session.user.id}`);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Encrypt message content
    const encryptedContent = encrypt(content, session.user.id);
    console.log("Encrypted content length:", encryptedContent.length);

    // Save message
    const [newMessage] = await db
      .insert(messages)
      .values({
        sessionId,
        role,
        contentEncrypted: encryptedContent,
      })
      .returning();

    console.log(`Message saved successfully: ${newMessage.id}`);

    // Update session updatedAt
    await db
      .update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));

    return NextResponse.json({
      message: {
        id: newMessage.id,
        role: newMessage.role,
        content,
        createdAt: newMessage.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to save message:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}

