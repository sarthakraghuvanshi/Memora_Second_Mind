import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/db";
import { documents } from "@/app/db/schema";
import { encrypt } from "@/app/lib/encryption";
import { processDocumentEmbeddings } from "@/app/lib/ingestion/process-document";
import { extractDatesFromText, getDateRange } from "@/app/lib/ingestion/date-extractor";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { content, title } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 }
      );
    }

    // Extract dates from content
    const contentDates = extractDatesFromText(content);
    const dateRange = getDateRange(contentDates);

    // Encrypt content
    const encryptedContent = encrypt(content, session.user.id);

    // Store in database
    const [document] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        type: "text",
        title: title || "Untitled Note",
        contentEncrypted: encryptedContent,
        metadataJson: {
          contentLength: content.length,
          createdBy: "text_input",
          contentDates: contentDates.map(d => d.toISOString()),
          contentDateRange: {
            earliest: dateRange.earliest?.toISOString() || null,
            latest: dateRange.latest?.toISOString() || null,
          },
        },
        fileSize: content.length,
        mimeType: "text/plain",
      })
      .returning();

    // Process embeddings asynchronously
    processDocumentEmbeddings(document.id, content, session.user.id).catch((error) => {
      console.error("Failed to process embeddings:", error);
    });

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: "Text saved successfully",
    });
  } catch (error) {
    console.error("Text ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to save text" },
      { status: 500 }
    );
  }
}

