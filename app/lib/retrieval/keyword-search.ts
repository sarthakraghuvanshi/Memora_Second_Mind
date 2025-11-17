import { db } from "@/app/db";
import { documents, chunks } from "@/app/db/schema";
import { eq, and, sql } from "drizzle-orm";

export interface KeywordMatch {
  chunkId: string;
  documentId: string;
  score: number;
}

/**
 * Extracts meaningful keywords from query
 * @param query - User query
 * @returns Array of keywords
 */
function extractKeywords(query: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "up", "about", "into", "through", "what",
    "when", "where", "who", "why", "how", "is", "are", "was", "were",
  ]);

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

/**
 * Performs keyword-based search on chunks
 * @param query - User query
 * @param userId - User ID to filter results
 * @returns Map of chunkId to keyword match score
 */
export async function keywordSearch(
  query: string,
  userId: string
): Promise<Map<string, number>> {
  const keywords = extractKeywords(query);
  
  if (keywords.length === 0) {
    return new Map();
  }

  // For now, return empty map since we need decrypted content for keyword matching
  // In production, you might want to index decrypted content in a separate search index
  // or use PostgreSQL full-text search on decrypted content
  
  // This is a placeholder for keyword scoring
  return new Map();
}

/**
 * Boosts scores based on keyword matches
 * @param baseScore - Original similarity score
 * @param keywordScore - Keyword match score
 * @returns Combined score
 */
export function combineScores(baseScore: number, keywordScore: number): number {
  // Weighted combination: 80% semantic, 20% keyword
  return baseScore * 0.8 + keywordScore * 0.2;
}

