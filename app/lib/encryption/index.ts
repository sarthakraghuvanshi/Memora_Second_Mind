/**
 * Encryption utilities for Memora
 * Provides AES-256-GCM encryption with per-user key derivation
 */

export { encrypt, decrypt } from "./crypto";
export { getUserKey } from "./key-management";

/**
 * Convenience function to encrypt content
 */
export function encryptContent(content: string, userId: string): string {
  const { encrypt } = require("./crypto");
  return encrypt(content, userId);
}

/**
 * Convenience function to decrypt content
 */
export function decryptContent(encrypted: string, userId: string): string {
  const { decrypt } = require("./crypto");
  return decrypt(encrypted, userId);
}

