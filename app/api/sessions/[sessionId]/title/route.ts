import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/db";
import { sessions } from "@/app/db/schema";
import { eq, and } from "drizzle-orm";

// PATCH - Update session title
export async function PATCH(
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
    const { title } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Verify session belongs to user and update
    const [updatedSession] = await db
      .update(sessions)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, session.user.id)))
      .returning();

    if (!updatedSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error("Failed to update title:", error);
    return NextResponse.json({ error: "Failed to update title" }, { status: 500 });
  }
}

