import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { hybridSearch, buildContext } from "@/app/lib/retrieval/search";
import { streamChatCompletion, buildSystemPrompt } from "@/app/lib/chat/gemini-chat";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { query, history = [] } = body;

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Chat query:", query);
    console.log("Conversation history:", history.length, "messages");

    // Step 1: Perform hybrid search with K=10
    const searchResults = await hybridSearch(query, session.user.id, 10);
    console.log(`Found ${searchResults.length} results`);

    // Step 2: Build context from search results
    const context = buildContext(searchResults);

    // Step 3: Build messages with conversation history
    const systemPrompt = buildSystemPrompt(context);
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: query },
    ];

    // Step 4: Stream response from Gemini
    const stream = await streamChatCompletion(messages);

    // Step 5: Create a readable stream for the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.text();
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

