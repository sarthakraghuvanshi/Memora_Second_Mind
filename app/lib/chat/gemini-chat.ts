import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  throw new Error("GOOGLE_GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

/**
 * Generates a chat completion with streaming using Gemini
 * @param messages - Array of chat messages
 * @returns Stream of completion chunks
 */
export async function streamChatCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // Gemini doesn't have a system role, so we prepend system message to the conversation
    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");
    
    // Build the full conversation with system context
    let fullPrompt = "";
    
    if (systemMessage) {
      fullPrompt = `${systemMessage.content}\n\n---\n\nConversation:\n\n`;
    }
    
    // Add conversation history
    conversationMessages.forEach((msg) => {
      if (msg.role === "user") {
        fullPrompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === "assistant") {
        fullPrompt += `Assistant: ${msg.content}\n\n`;
      }
    });
    
    // Remove the last "Assistant: " if the last message is from user
    // because Gemini will generate the assistant's response
    if (conversationMessages[conversationMessages.length - 1]?.role === "user") {
      fullPrompt += "Assistant: ";
    }

    const result = await model.generateContentStream(fullPrompt);
    
    return result.stream;
  } catch (error) {
    console.error("Gemini chat error:", error);
    throw new Error("Failed to generate response");
  }
}

/**
 * Builds system prompt with context for Gemini
 * @param context - Retrieved context from documents
 * @returns System prompt string
 */
export function buildSystemPrompt(context: string): string {
  return `You are Memora, an AI assistant that helps users recall and understand information from their personal knowledge base.

Your role:
- Answer questions based on the provided context from the user's documents
- Remember and reference previous messages in our conversation
- Be concise and accurate
- If the context doesn't contain relevant information, say so clearly
- Cite document titles when referencing specific information

Context from user's documents:
${context}

Instructions:
- Use both the provided context AND our conversation history to answer questions
- If the user asks about previous messages (e.g., "What was my last question?"), refer to the conversation above
- If you're unsure about document content, say "I don't have enough information to answer that"
- Be helpful and conversational`;
}

/**
 * Type for Gemini stream chunk
 */
export interface GeminiChunk {
  text: () => string;
}

