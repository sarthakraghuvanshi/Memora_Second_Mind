import crypto from "crypto";

/**
 * Derives a per-user encryption key from the master key and user ID
 * Uses PBKDF2 for deterministic key derivation
 */
export function getUserKey(userId: string): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY;
  
  if (!masterKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // Use PBKDF2 to derive a user-specific key
  // Salt is the userId to ensure different users get different keys
  const key = crypto.pbkdf2Sync(
    masterKey,
    userId,
    100000, // iterations
    32, // key length (256 bits)
    "sha256"
  );

  return key;
}

