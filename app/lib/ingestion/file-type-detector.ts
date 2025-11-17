/**
 * Detects file type when MIME type is unreliable
 * Uses file extension as fallback
 */

export function detectFileType(filename: string, mimeType: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // Office formats
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc") return "application/msword";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === "ppt") return "application/vnd.ms-powerpoint";
  if (ext === "odt") return "application/vnd.oasis.opendocument.text";
  if (ext === "ods") return "application/vnd.oasis.opendocument.spreadsheet";
  if (ext === "odp") return "application/vnd.oasis.opendocument.presentation";

  // Audio
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/x-m4a";
  if (ext === "wav") return "audio/wav";
  if (ext === "aac") return "audio/aac";
  if (ext === "flac") return "audio/flac";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "wma") return "audio/x-ms-wma";

  // Images
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "bmp") return "image/bmp";
  if (ext === "tiff" || ext === "tif") return "image/tiff";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "heic") return "image/heic";

  // Return original MIME type if no match
  return mimeType;
}

