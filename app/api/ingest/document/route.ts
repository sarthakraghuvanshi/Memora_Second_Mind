import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/db";
import { documents } from "@/app/db/schema";
import { encrypt } from "@/app/lib/encryption";
import { extractTextFromPDF } from "@/app/lib/ingestion/extractors/pdf-extractor";
import { extractTextFromTextFile } from "@/app/lib/ingestion/extractors/text-extractor";
import { extractTextFromImage } from "@/app/lib/ingestion/extractors/image-extractor";
import { transcribeAudio } from "@/app/lib/ingestion/extractors/audio-extractor";
import { extractTextFromDOCX, extractTextFromExcel, extractTextFromPPTX, extractTextFromCSV } from "@/app/lib/ingestion/extractors/office-extractor";
import { extractTextFromOpenOffice } from "@/app/lib/ingestion/extractors/openoffice-extractor";
import { 
  validateFile, 
  isPDF, 
  isTextFile, 
  isImage, 
  isAudio,
  isDOCX,
  isExcel,
  isPPTX,
  isCSV,
  isCodeOrData,
  isOpenOffice
} from "@/app/lib/ingestion/validate";
import { extractFileMetadata, generateTitleFromFilename } from "@/app/lib/ingestion/metadata";
import { processDocumentEmbeddings } from "@/app/lib/ingestion/process-document";
import { detectFileType } from "@/app/lib/ingestion/file-type-detector";
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const titleOverride = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file
    try {
      validateFile(file);
    } catch (validationError: any) {
      return NextResponse.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    // Extract metadata
    const metadata = extractFileMetadata(file);
    const title = titleOverride || generateTitleFromFilename(file.name);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detect actual file type (fallback to extension if MIME is wrong)
    const actualMimeType = detectFileType(file.name, file.type);
    console.log(`Processing file: ${file.name}, MIME: ${file.type} → ${actualMimeType}`);

    // Extract text based on file type
    let extractedText: string;
    let documentType: "document" | "image" | "audio" | "web" | "text" = "document";
    
    // Use detected MIME type for processing
    if (isPDF(actualMimeType)) {
      extractedText = await extractTextFromPDF(buffer);
    } else if (isDOCX(actualMimeType)) {
      extractedText = await extractTextFromDOCX(buffer);
    } else if (isExcel(actualMimeType)) {
      extractedText = await extractTextFromExcel(buffer);
    } else if (isPPTX(actualMimeType)) {
      extractedText = await extractTextFromPPTX(buffer);
    } else if (isCSV(actualMimeType)) {
      extractedText = await extractTextFromCSV(buffer);
    } else if (isOpenOffice(actualMimeType)) {
      extractedText = await extractTextFromOpenOffice(buffer, actualMimeType, file.name);
    } else if (isTextFile(actualMimeType) || isCodeOrData(actualMimeType, file.name)) {
      extractedText = await extractTextFromTextFile(buffer);
    } else if (isImage(actualMimeType)) {
      extractedText = await extractTextFromImage(buffer, actualMimeType);
      documentType = "image";
    } else if (isAudio(actualMimeType)) {
      extractedText = await transcribeAudio(buffer, actualMimeType);
      documentType = "audio";
    } else {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    // Extract dates from content
    const contentDates = extractDatesFromText(extractedText);
    const dateRange = getDateRange(contentDates);

    console.log(`Extracted ${contentDates.length} dates from content:`, contentDates.map(d => d.toLocaleDateString()));

    // Encrypt the extracted text
    const encryptedContent = encrypt(extractedText, session.user.id);

    // Store in database
    const [document] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        type: documentType,
        title,
        contentEncrypted: encryptedContent,
        metadataJson: {
          ...metadata,
          extractedTextLength: extractedText.length,
          contentDates: contentDates.map(d => d.toISOString()),
          contentDateRange: {
            earliest: dateRange.earliest?.toISOString() || null,
            latest: dateRange.latest?.toISOString() || null,
          },
        },
        fileSize: file.size,
        mimeType: file.type,
      })
      .returning();

    // Process embeddings asynchronously
    processDocumentEmbeddings(document.id, extractedText, session.user.id).catch((error) => {
      console.error("Failed to process embeddings:", error);
    });

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: "Document uploaded and processed successfully",
      metadata: {
        title,
        fileSize: file.size,
        extractedTextLength: extractedText.length,
      },
    });
  } catch (error) {
    console.error("Document ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}

