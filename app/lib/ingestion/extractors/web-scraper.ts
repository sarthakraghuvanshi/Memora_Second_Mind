import * as cheerio from "cheerio";

/**
 * Fetches and extracts text content from a URL
 * @param url - URL to scrape
 * @returns Extracted text content and metadata
 */
export async function scrapeWebContent(url: string): Promise<{
  text: string;
  title: string;
  description: string;
}> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith("http")) {
      throw new Error("Only HTTP/HTTPS URLs are supported");
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Memora/1.0; +https://memora.app)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Parse HTML with Cheerio
    const $ = cheerio.load(html);

    // Remove script and style tags
    $("script, style, nav, footer, header").remove();

    // Extract metadata
    const title =
      $("title").text() ||
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text() ||
      "Untitled Page";

    const description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    // Extract main text content
    // Try to find main content area
    let mainText = "";
    
    const mainSelectors = ["main", "article", '[role="main"]', ".content", "#content"];
    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        mainText = element.text();
        break;
      }
    }

    // If no main content found, extract from body
    if (!mainText) {
      mainText = $("body").text();
    }

    // Clean up whitespace
    const cleanedText = mainText
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, "\n") // Remove empty lines
      .trim();

    if (!cleanedText || cleanedText.length < 50) {
      throw new Error("Insufficient text content extracted from URL");
    }

    return {
      text: cleanedText,
      title: title.trim(),
      description: description.trim(),
    };
  } catch (error) {
    console.error("Web scraping error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to scrape web content");
  }
}

