import { db } from "@/app/db";
import { embeddings, chunks, documents } from "@/app/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { DateRange } from "./temporal-parser";

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkContent: string; // encrypted
  similarity: number;
  createdAt: Date;
}

/**
 * Calculates cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score (0 to 1)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Performs vector similarity search
 * @param queryEmbedding - Embedding vector for the query
 * @param userId - User ID to filter results
 * @param dateRange - Optional date range filter
 * @param limit - Maximum number of results
 * @returns Array of search results sorted by similarity
 */
export async function vectorSearch(
  queryEmbedding: number[],
  userId: string,
  dateRange: DateRange | null = null,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    // Build query conditions
    const conditions = [eq(documents.userId, userId)];
    
    // Note: Temporal filtering now happens after retrieval
    // We need to check both createdAt and contentDates in metadata

    // Fetch all embeddings with their chunks and documents (filtered by user only)
    const results = await db
      .select({
        embeddingId: embeddings.id,
        embeddingVector: embeddings.embedding,
        chunkId: chunks.id,
        chunkContent: chunks.contentEncrypted,
        documentId: documents.id,
        documentTitle: documents.title,
        createdAt: documents.createdAt,
        metadataJson: documents.metadataJson,
      })
      .from(embeddings)
      .innerJoin(chunks, eq(embeddings.chunkId, chunks.id))
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(and(...conditions));

    // Filter by date range (check both createdAt and content dates)
    let filteredResults = results;
    
    if (dateRange) {
      filteredResults = results.filter((result) => {
        // Check if document was created in range
        const createdInRange =
          result.createdAt >= dateRange.start && result.createdAt <= dateRange.end;

        // Check if document mentions dates in range
        let contentDatesInRange = false;
        const metadata = result.metadataJson as any;
        
        if (metadata?.contentDates && Array.isArray(metadata.contentDates)) {
          contentDatesInRange = metadata.contentDates.some((dateStr: string) => {
            const date = new Date(dateStr);
            return date >= dateRange.start && date <= dateRange.end;
          });
        }

        // Include if EITHER creation date OR content dates match
        return createdInRange || contentDatesInRange;
      });

      console.log(`Filtered from ${results.length} to ${filteredResults.length} documents by date range`);
    }

    // Calculate similarity scores
    const scoredResults = filteredResults.map((result) => {
      const embeddingVector = JSON.parse(result.embeddingVector) as number[];
      const similarity = cosineSimilarity(queryEmbedding, embeddingVector);

      return {
        chunkId: result.chunkId,
        documentId: result.documentId,
        documentTitle: result.documentTitle || "Untitled",
        chunkContent: result.chunkContent,
        similarity,
        createdAt: result.createdAt,
      };
    });

    // Sort by similarity and return top results
    return scoredResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error) {
    console.error("Vector search error:", error);
    throw new Error("Failed to perform vector search");
  }
}

