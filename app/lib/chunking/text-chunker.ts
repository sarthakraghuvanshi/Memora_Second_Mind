/**
 * Chunks text into smaller pieces for embedding generation
 * Uses a simple character-based chunking with overlap
 */

interface ChunkResult {
  text: string;
  startChar: number;
  endChar: number;
  index: number;
}

const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

/**
 * Splits text into chunks with overlap
 * @param text - The text to chunk
 * @returns Array of chunk objects with text, positions, and index
 */
export function chunkText(text: string): ChunkResult[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: ChunkResult[] = [];
  let startChar = 0;
  let index = 0;

  while (startChar < text.length) {
    const endChar = Math.min(startChar + CHUNK_SIZE, text.length);
    const chunkText = text.substring(startChar, endChar);

    chunks.push({
      text: chunkText,
      startChar,
      endChar,
      index,
    });

    // Move start position forward, accounting for overlap
    startChar += CHUNK_SIZE - CHUNK_OVERLAP;
    index++;

    // If we're close to the end, just take the rest
    if (startChar + CHUNK_OVERLAP >= text.length && startChar < text.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Estimates the number of tokens in text (rough approximation)
 * @param text - The text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

