import { subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse } from "date-fns";

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Parses temporal expressions from query text
 * @param query - User query text
 * @returns Date range if temporal expression found, null otherwise
 */
export function parseTemporalQuery(query: string): DateRange | null {
  const lowerQuery = query.toLowerCase();
  const now = new Date();

  // Today
  if (lowerQuery.includes("today")) {
    return {
      start: startOfDay(now),
      end: endOfDay(now),
    };
  }

  // Yesterday
  if (lowerQuery.includes("yesterday")) {
    const yesterday = subDays(now, 1);
    return {
      start: startOfDay(yesterday),
      end: endOfDay(yesterday),
    };
  }

  // Last X days
  const lastDaysMatch = lowerQuery.match(/last (\d+) days?/);
  if (lastDaysMatch) {
    const days = parseInt(lastDaysMatch[1]);
    return {
      start: subDays(now, days),
      end: now,
    };
  }

  // Last week
  if (lowerQuery.includes("last week")) {
    return {
      start: subWeeks(now, 1),
      end: now,
    };
  }

  // This week
  if (lowerQuery.includes("this week")) {
    return {
      start: startOfWeek(now),
      end: endOfWeek(now),
    };
  }

  // Last month
  if (lowerQuery.includes("last month")) {
    return {
      start: subMonths(now, 1),
      end: now,
    };
  }

  // This month
  if (lowerQuery.includes("this month")) {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
    };
  }

  // No temporal expression found
  return null;
}

/**
 * Removes temporal expressions from query text
 * @param query - Original query
 * @returns Query with temporal expressions removed
 */
export function removeTemporalExpressions(query: string): string {
  const temporalPatterns = [
    /\b(today|yesterday)\b/gi,
    /\blast \d+ days?\b/gi,
    /\b(last|this) week\b/gi,
    /\b(last|this) month\b/gi,
  ];

  let cleanedQuery = query;
  temporalPatterns.forEach((pattern) => {
    cleanedQuery = cleanedQuery.replace(pattern, "");
  });

  return cleanedQuery.trim();
}

