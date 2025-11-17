import { generateEmbedding } from "@/app/lib/embeddings/openai-client";
import { vectorSearch, SearchResult } from "./vector-search";
import { parseTemporalQuery, removeTemporalExpressions } from "./temporal-parser";
import { decrypt } from "@/app/lib/encryption";

export interface ProcessedResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string; // decrypted
  similarity: number;
  createdAt: Date;
}

/**
 * Main search function combining all search methodologies
 * @param query - User query
 * @param userId - User ID for filtering and decryption
 * @param limit - Maximum number of results
 * @returns Array of processed search results
 */
export async function hybridSearch(
  query: string,
  userId: string,
  limit: number = 10
): Promise<ProcessedResult[]> {
  try {
    // Step 1: Parse temporal expressions
    const dateRange = parseTemporalQuery(query);
    const cleanedQuery = removeTemporalExpressions(query);

    console.log("Search query:", query);
    console.log("Date range:", dateRange);
    console.log("Cleaned query:", cleanedQuery);

    // Step 2: Generate query embedding
    const queryEmbedding = await generateEmbedding(cleanedQuery);

    // Step 3: Perform vector search with temporal filtering
    const results = await vectorSearch(
      queryEmbedding,
      userId,
      dateRange,
      limit
    );

    // Step 4: Decrypt chunk content
    const processedResults: ProcessedResult[] = results.map((result) => {
      try {
        const decryptedContent = decrypt(result.chunkContent, userId);
        return {
          chunkId: result.chunkId,
          documentId: result.documentId,
          documentTitle: result.documentTitle,
          content: decryptedContent,
          similarity: result.similarity,
          createdAt: result.createdAt,
        };
      } catch (error) {
        console.error(`Failed to decrypt chunk ${result.chunkId}:`, error);
        return null;
      }
    }).filter((result): result is ProcessedResult => result !== null);

    // Step 5: Keyword boosting (optional enhancement)
    // For now, we're relying on semantic search
    // Keyword matching can be done on decrypted content here if needed

    // Step 6: Rerank by recency (boost recent content slightly)
    const rerankedResults = processedResults.map((result) => {
      const daysSinceCreation = (Date.now() - result.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 1 - daysSinceCreation / 365) * 0.1; // Up to 10% boost for recent content
      
      return {
        ...result,
        similarity: result.similarity + recencyBoost,
      };
    });

    // Sort by final score
    return rerankedResults.sort((a, b) => b.similarity - a.similarity);
  } catch (error) {
    console.error("Hybrid search error:", error);
    throw new Error("Failed to perform search");
  }
}

/**
 * Builds context string from search results for LLM
 * @param results - Search results
 * @returns Formatted context string
 */
export function buildContext(results: ProcessedResult[]): string {
  if (results.length === 0) {
    return "No relevant information found.";
  }

  return results
    .map((result, index) => {
      return `[${index + 1}] From "${result.documentTitle}" (${result.createdAt.toLocaleDateString()}):\n${result.content}\n`;
    })
    .join("\n---\n\n");
}

