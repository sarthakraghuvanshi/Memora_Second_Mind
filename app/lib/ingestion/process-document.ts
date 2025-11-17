import { db } from "@/app/db";
import { chunks, embeddings } from "@/app/db/schema";
import { chunkText } from "@/app/lib/chunking/text-chunker";
import { generateEmbeddings } from "@/app/lib/embeddings/openai-client";
import { encrypt } from "@/app/lib/encryption";

/**
 * Processes a document by chunking and generating embeddings
 * @param documentId - ID of the document to process
 * @param plaintext - Decrypted text content
 * @param userId - User ID for encryption
 */
export async function processDocumentEmbeddings(
  documentId: string,
  plaintext: string,
  userId: string
): Promise<void> {
  try {
    // Step 1: Chunk the text
    const textChunks = chunkText(plaintext);

    if (textChunks.length === 0) {
      console.warn(`No chunks generated for document ${documentId}`);
      return;
    }

    console.log(`Processing ${textChunks.length} chunks for document ${documentId}`);

    // Step 2: Generate embeddings for all chunks in batch
    const chunkTexts = textChunks.map((chunk) => chunk.text);
    const embeddingVectors = await generateEmbeddings(chunkTexts);

    // Step 3: Store chunks and embeddings in database
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const embeddingVector = embeddingVectors[i];

      // Encrypt chunk content
      const encryptedContent = encrypt(chunk.text, userId);

      // Insert chunk
      const [insertedChunk] = await db
        .insert(chunks)
        .values({
          documentId,
          chunkIndex: chunk.index,
          contentEncrypted: encryptedContent,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
        })
        .returning();

      // Insert embedding
      // Convert embedding array to string for storage
      await db.insert(embeddings).values({
        chunkId: insertedChunk.id,
        embedding: JSON.stringify(embeddingVector),
        model: "text-embedding-3-small",
      });
    }

    console.log(`Successfully processed ${textChunks.length} chunks for document ${documentId}`);
  } catch (error) {
    console.error("Error processing document embeddings:", error);
    throw new Error("Failed to process document embeddings");
  }
}

