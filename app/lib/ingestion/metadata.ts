/**
 * Extracts metadata from uploaded file
 */
export function extractFileMetadata(file: File) {
  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    lastModified: new Date(file.lastModified),
  };
}

/**
 * Generates a title from filename
 */
export function generateTitleFromFilename(filename: string): string {
  // Remove extension and replace underscores/hyphens with spaces
  return filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[-_]/g, " ") // Replace - and _ with spaces
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
}

