import crypto from "crypto";
import { getUserKey } from "./key-management";

/**
 * Encrypts plaintext using AES-256-GCM with per-user key
 * @param plaintext - The text to encrypt
 * @param userId - The user ID to derive encryption key from
 * @returns Base64-encoded encrypted data (IV + authTag + ciphertext)
 */
export function encrypt(plaintext: string, userId: string): string {
  try {
    const key = getUserKey(userId);
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(12); // 12 bytes for GCM
    
    // Create cipher
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, "base64"),
    ]);
    
    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM with per-user key
 * @param ciphertext - Base64-encoded encrypted data (IV + authTag + ciphertext)
 * @param userId - The user ID to derive decryption key from
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string, userId: string): string {
  try {
    const key = getUserKey(userId);
    
    // Decode the combined data
    const combined = Buffer.from(ciphertext, "base64");
    
    // Extract IV (first 12 bytes)
    const iv = combined.subarray(0, 12);
    
    // Extract auth tag (next 16 bytes)
    const authTag = combined.subarray(12, 28);
    
    // Extract encrypted data (remaining bytes)
    const encrypted = combined.subarray(28);
    
    // Create decipher
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted.toString("base64"), "base64", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

