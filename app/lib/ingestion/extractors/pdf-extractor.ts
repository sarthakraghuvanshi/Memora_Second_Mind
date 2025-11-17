// @ts-ignore
import PDFParser from "pdf2json";

/**
 * Extracts text content from a PDF file using pdf2json
 * @param buffer - PDF file buffer
 * @returns Extracted text content
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          let fullText = "";

          // Extract text from all pages
          if (pdfData.Pages) {
            pdfData.Pages.forEach((page: any) => {
              if (page.Texts) {
                page.Texts.forEach((text: any) => {
                  if (text.R) {
                    text.R.forEach((r: any) => {
                      if (r.T) {
                        // Decode URI-encoded text
                        fullText += decodeURIComponent(r.T) + " ";
                      }
                    });
                  }
                });
                fullText += "\n";
              }
            });
          }

          resolve(fullText.trim());
        } catch (error) {
          reject(new Error("Failed to parse PDF data"));
        }
      });

      pdfParser.on("pdfParser_dataError", (error: any) => {
        reject(new Error(`PDF parsing error: ${error.parserError}`));
      });

      // Parse the PDF buffer
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error("PDF extraction error:", error);
      reject(new Error("Failed to extract text from PDF"));
    }
  });
}

