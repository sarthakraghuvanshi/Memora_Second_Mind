import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  throw new Error("GOOGLE_GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

/**
 * Extracts text from an image using Gemini Vision API
 * @param buffer - Image file buffer
 * @param mimeType - Image MIME type
 * @returns Extracted text content
 */
export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // Convert buffer to base64
    const imageBase64 = buffer.toString("base64");

    const prompt = `Extract and return all text content from this image. 
If the image contains:
- Text/documents: transcribe all visible text
- Screenshots: extract all readable text
- Charts/graphs: describe the data and any labels
- Handwriting: transcribe to the best of your ability
- No text: describe what you see in the image

Return only the extracted/transcribed text or description, without any preamble.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ]);

    const response = result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw new Error("No text extracted from image");
    }

    return text.trim();
  } catch (error) {
    console.error("Image text extraction error:", error);
    throw new Error("Failed to extract text from image");
  }
}

