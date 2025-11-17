/**
 * For OpenOffice formats (ODT, ODS, ODP), we use Gemini to extract text
 * These are ZIP archives containing XML - complex to parse natively
 * Gemini can handle them directly
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  throw new Error("GOOGLE_GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

/**
 * Extracts text from OpenOffice files using Gemini
 * @param buffer - File buffer
 * @param mimeType - File MIME type
 * @param filename - Original filename
 * @returns Extracted text content
 */
export async function extractTextFromOpenOffice(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const base64 = buffer.toString("base64");

    const prompt = `Extract all text content from this ${filename} file. Return only the extracted text without any preamble.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
    ]);

    const text = result.response.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error("No text extracted");
    }

    return text.trim();
  } catch (error) {
    console.error("OpenOffice extraction error:", error);
    throw new Error(`Failed to extract text from ${filename}`);
  }
}

