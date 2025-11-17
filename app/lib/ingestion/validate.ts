// Allowed MIME types for document upload
const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  // Office formats
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
  "application/msword", // DOC
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
  "application/vnd.ms-excel", // XLS
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
  "application/vnd.ms-powerpoint", // PPT
  "application/rtf",
  "text/csv",
  // OpenOffice
  "application/vnd.oasis.opendocument.text", // ODT
  "application/vnd.oasis.opendocument.spreadsheet", // ODS
  "application/vnd.oasis.opendocument.presentation", // ODP
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/aac",
  "audio/flac",
  "audio/ogg",
  "audio/x-ms-wma",
  // Code/Data
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
  "application/javascript",
  "text/javascript",
  "application/typescript",
];

/**
 * Validates uploaded file
 * @param file - File to validate
 * @throws Error if validation fails
 */
export function validateFile(file: File): void {
  // Check MIME type (allow common file extensions even if MIME is wrong)
  const isAllowed = ALLOWED_MIME_TYPES.includes(file.type) || 
                    isCodeOrData(file.type, file.name) ||
                    file.type === "" || // Browser sometimes sends empty MIME
                    file.type === "application/octet-stream"; // Generic binary

  if (!isAllowed) {
    // Check by extension as fallback
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = [
      "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
      "csv", "rtf", "txt", "md", "jpg", "jpeg", "png", "webp", "gif", "bmp",
      "tiff", "svg", "heic", "mp3", "m4a", "wav", "aac", "flac", "ogg", "wma",
      "json", "xml", "html", "js", "ts", "py", "java", "cpp", "c", "go", 
      "rs", "rb", "php", "yml", "yaml",
    ];
    
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`File type not supported: ${ext || file.type}`);
    }
  }

  // No file size limit - removed for flexibility
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Checks if file is a PDF
 */
export function isPDF(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

/**
 * Checks if file is a text file
 */
export function isTextFile(mimeType: string): boolean {
  return mimeType.startsWith("text/");
}

/**
 * Checks if file is an image
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Checks if file is an audio file
 */
export function isAudio(mimeType: string): boolean {
  return mimeType.startsWith("audio/");
}

/**
 * Checks if file is DOCX
 */
export function isDOCX(mimeType: string): boolean {
  return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
         mimeType === "application/msword";
}

/**
 * Checks if file is Excel
 */
export function isExcel(mimeType: string): boolean {
  return mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
         mimeType === "application/vnd.ms-excel";
}

/**
 * Checks if file is PowerPoint
 */
export function isPPTX(mimeType: string): boolean {
  return mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
         mimeType === "application/vnd.ms-powerpoint";
}

/**
 * Checks if file is CSV
 */
export function isCSV(mimeType: string): boolean {
  return mimeType === "text/csv";
}

/**
 * Checks if file is code/data (treat as text)
 */
export function isCodeOrData(mimeType: string, filename: string): boolean {
  // Check by MIME type
  const codeMimeTypes = [
    "application/json",
    "application/xml",
    "text/xml",
    "text/html",
    "application/javascript",
    "text/javascript",
    "application/typescript",
  ];
  
  if (codeMimeTypes.includes(mimeType)) return true;
  
  // Check by file extension for code files
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const codeExtensions = [
    "js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "cs",
    "go", "rs", "rb", "php", "swift", "kt", "scala", "r", "m",
    "sql", "sh", "bash", "yml", "yaml", "toml", "ini", "env",
  ];
  
  return codeExtensions.includes(ext);
}

/**
 * Checks if file is OpenOffice format
 */
export function isOpenOffice(mimeType: string): boolean {
  return mimeType === "application/vnd.oasis.opendocument.text" || // ODT
         mimeType === "application/vnd.oasis.opendocument.spreadsheet" || // ODS
         mimeType === "application/vnd.oasis.opendocument.presentation"; // ODP
}

