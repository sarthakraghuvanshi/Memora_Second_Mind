import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { hybridSearch, buildContext } from "@/app/lib/retrieval/search";

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
    const { query, limit = 10 } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    // Perform hybrid search
    const results = await hybridSearch(query, session.user.id, limit);

    // Build context for LLM
    const context = buildContext(results);

    return NextResponse.json({
      success: true,
      query,
      results: results.map((r) => ({
        documentTitle: r.documentTitle,
        content: r.content.substring(0, 200) + "...", // Preview only
        similarity: r.similarity,
        createdAt: r.createdAt,
      })),
      context,
      totalResults: results.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}

