import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  throw new Error("GOOGLE_GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

// POST - Generate chat title from first message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstMessage } = body;

    if (!firstMessage) {
      return NextResponse.json({ error: "First message is required" }, { status: 400 });
    }

    // Use Gemini to generate a short title
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const prompt = `Generate a very short title (3-5 words max) for a chat that starts with this message: "${firstMessage}"

Rules:
- Maximum 5 words
- No quotes or punctuation
- Descriptive and clear
- Return ONLY the title, nothing else

Example:
Message: "How do I deploy Next.js to Vercel?"
Title: Next.js Vercel Deployment`;

    const result = await model.generateContent(prompt);
    const title = result.response.text().trim();

    // Truncate if too long
    const finalTitle = title.length > 50 ? title.substring(0, 50) : title;

    return NextResponse.json({ title: finalTitle });
  } catch (error) {
    console.error("Failed to generate title:", error);
    // Fallback to first few words of message
    const body = await request.json();
    const fallbackTitle = body.firstMessage?.substring(0, 30) || "New Chat";
    return NextResponse.json({ title: fallbackTitle });
  }
}

