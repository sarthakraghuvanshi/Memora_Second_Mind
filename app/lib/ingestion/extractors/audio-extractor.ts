import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  throw new Error("GOOGLE_GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

/**
 * Transcribes audio to text using Gemini API
 * @param buffer - Audio file buffer
 * @param mimeType - Audio MIME type
 * @returns Transcribed text content
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // Convert buffer to base64
    const audioBase64 = buffer.toString("base64");

    const prompt = `Transcribe the audio content accurately. Return only the transcribed text without any preamble or explanation.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      },
    ]);

    const response = result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw new Error("No transcription returned from audio");
    }

    return text.trim();
  } catch (error) {
    console.error("Audio transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}

