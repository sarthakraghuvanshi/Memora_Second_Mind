/**
 * Extracts text content from text-based files (TXT, MD)
 * @param buffer - File buffer
 * @returns Extracted text content
 */
export async function extractTextFromTextFile(buffer: Buffer): Promise<string> {
  try {
    return buffer.toString("utf-8");
  } catch (error) {
    console.error("Text extraction error:", error);
    throw new Error("Failed to extract text from file");
  }
}

