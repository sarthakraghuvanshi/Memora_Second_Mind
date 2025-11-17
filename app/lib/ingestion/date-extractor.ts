import { parse, isValid } from "date-fns";

/**
 * Extracts dates from text content
 * @param text - Text to extract dates from
 * @returns Array of extracted dates
 */
export function extractDatesFromText(text: string): Date[] {
  const dates: Date[] = [];
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
    // YYYY-MM-DD
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,
    // Month DD, YYYY or DD Month YYYY
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    // Month DD (current year assumed)
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/gi,
    // DD Month (current year assumed)
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/gi,
  ];

  const currentYear = new Date().getFullYear();

  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    
    for (const match of matches) {
      try {
        let date: Date | null = null;

        // Try to parse the matched date
        if (match[0].includes("/") || match[0].includes("-")) {
          // Try common date formats
          const formats = [
            "dd/MM/yyyy",
            "MM/dd/yyyy",
            "yyyy-MM-dd",
            "dd-MM-yyyy",
          ];

          for (const format of formats) {
            const parsed = parse(match[0], format, new Date());
            if (isValid(parsed)) {
              date = parsed;
              break;
            }
          }
        } else {
          // Month name format
          const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
          ];
          
          const shortMonthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];

          // Try to parse month-day-year or day-month-year
          const formats = [
            "MMMM dd, yyyy",
            "MMMM dd yyyy",
            "dd MMMM yyyy",
            "dd MMM yyyy",
            "MMMM dd",
            "dd MMMM",
          ];

          for (const format of formats) {
            const parsed = parse(match[0], format, new Date());
            if (isValid(parsed)) {
              date = parsed;
              // If year is missing, use current year
              if (!match[0].match(/\d{4}/)) {
                date.setFullYear(currentYear);
              }
              break;
            }
          }
        }

        if (date && isValid(date)) {
          dates.push(date);
        }
      } catch (error) {
        // Skip invalid dates
        continue;
      }
    }
  }

  // Remove duplicates and sort
  const uniqueDates = Array.from(
    new Set(dates.map((d) => d.toISOString()))
  ).map((iso) => new Date(iso));

  return uniqueDates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Gets the date range from extracted dates
 * @param dates - Array of dates
 * @returns Object with earliest and latest dates
 */
export function getDateRange(dates: Date[]): {
  earliest: Date | null;
  latest: Date | null;
} {
  if (dates.length === 0) {
    return { earliest: null, latest: null };
  }

  return {
    earliest: dates[0],
    latest: dates[dates.length - 1],
  };
}

