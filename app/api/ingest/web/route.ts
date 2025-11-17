import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/db";
import { documents } from "@/app/db/schema";
import { encrypt } from "@/app/lib/encryption";
import { scrapeWebContent } from "@/app/lib/ingestion/extractors/web-scraper";
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
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    console.log("Scraping URL:", url);

    // Scrape web content
    let scrapedContent;
    try {
      scrapedContent = await scrapeWebContent(url);
    } catch (scrapeError: any) {
      return NextResponse.json(
        { error: scrapeError.message || "Failed to scrape URL" },
        { status: 400 }
      );
    }

    // Extract dates from content
    const contentDates = extractDatesFromText(scrapedContent.text);
    const dateRange = getDateRange(contentDates);

    // Encrypt the extracted text
    const encryptedContent = encrypt(scrapedContent.text, session.user.id);

    // Store in database
    const [document] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        type: "web",
        title: scrapedContent.title,
        contentEncrypted: encryptedContent,
        metadataJson: {
          description: scrapedContent.description,
          url,
          extractedTextLength: scrapedContent.text.length,
          scrapedAt: new Date().toISOString(),
          contentDates: contentDates.map(d => d.toISOString()),
          contentDateRange: {
            earliest: dateRange.earliest?.toISOString() || null,
            latest: dateRange.latest?.toISOString() || null,
          },
        },
        sourceUrl: url,
        fileSize: scrapedContent.text.length,
        mimeType: "text/html",
      })
      .returning();

    // Process embeddings asynchronously
    processDocumentEmbeddings(document.id, scrapedContent.text, session.user.id).catch((error) => {
      console.error("Failed to process embeddings:", error);
    });

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: "Web content saved successfully",
      metadata: {
        title: scrapedContent.title,
        url,
        extractedTextLength: scrapedContent.text.length,
      },
    });
  } catch (error) {
    console.error("Web ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to save web content" },
      { status: 500 }
    );
  }
}

