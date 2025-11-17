import mammoth from "mammoth";
import * as XLSX from "xlsx";

/**
 * Extracts text from DOCX files
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw new Error("Failed to extract text from DOCX");
  }
}

/**
 * Extracts text from Excel files (XLSX, XLS)
 */
export async function extractTextFromExcel(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let allText = "";

    // Extract text from all sheets
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      allText += `Sheet: ${sheetName}\n`;
      
      // Convert sheet to CSV for text extraction
      const csv = XLSX.utils.sheet_to_csv(sheet);
      allText += csv + "\n\n";
    });

    return allText.trim();
  } catch (error) {
    console.error("Excel extraction error:", error);
    throw new Error("Failed to extract text from Excel");
  }
}

/**
 * Extracts text from CSV files
 */
export async function extractTextFromCSV(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(firstSheet);
  } catch (error) {
    console.error("CSV extraction error:", error);
    throw new Error("Failed to extract text from CSV");
  }
}

/**
 * Extracts text from PowerPoint files
 */
export async function extractTextFromPPTX(buffer: Buffer): Promise<string> {
  try {
    // @ts-ignore
    const pptxParser = require("pptx-parser");
    
    return new Promise((resolve, reject) => {
      pptxParser.parseBuffer(buffer, (err: any, result: any) => {
        if (err) {
          reject(new Error("Failed to parse PPTX"));
          return;
        }

        let allText = "";
        if (result && result.slides) {
          result.slides.forEach((slide: any, index: number) => {
            allText += `Slide ${index + 1}:\n`;
            if (slide.text) {
              allText += slide.text.join("\n") + "\n\n";
            }
          });
        }

        resolve(allText.trim());
      });
    });
  } catch (error) {
    console.error("PPTX extraction error:", error);
    throw new Error("Failed to extract text from PPTX");
  }
}

