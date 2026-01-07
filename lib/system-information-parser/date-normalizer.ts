// Date & Time Normalization Utility
// Normalize various date string formats to standard YYYY-MM-DD and HH:mm:ss format

export interface NormalizedDateTime {
  date: string | null;  // Format: YYYY-MM-DD
  time: string;         // Format: HH:mm:ss (ALWAYS string, default "00:00:00" if not available)
}

/**
 * Normalize date string to standard YYYY-MM-DD and HH:mm:ss format (separated)
 * 
 * @param dateString - Raw date string from file (various formats)
 * @param fallbackDate - Date object for fallback if parsing fails
 * @returns Object with separated date and time
 */
export function normalizeDateTime(
  dateString: string | null | undefined,
  fallbackDate?: Date
): NormalizedDateTime {
  // Default return if input is null/undefined
  if (!dateString || dateString.trim() === '') {
    if (fallbackDate) {
      return {
        date: formatDate(fallbackDate),
        time: formatTime(fallbackDate),
      };
    }
    return {
      date: null,
      time: '00:00:00', // Always return string, not null
    };
  }

  const cleaned = dateString.trim();

  // Handle special values that are not dates
  const specialValues = ['disabled', 'none', 'n/a', 'null', 'unknown'];
  if (specialValues.includes(cleaned.toLowerCase())) {
    return {
      date: null,
      time: '00:00:00',
    };
  }

  // Priority 1: Format YYYY-MM-DD (ISO 8601) - Easiest to parse
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, year, month, day, hour, minute, second] = isoMatch;
    return {
      date: `${year}-${month}-${day}`,
      time: hour && minute && second ? `${hour}:${minute}:${second}` : '00:00:00',
    };
  }

  // Priority 2: Numeric format with separator (DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, YYYY-MM-DD)
  const numericMatch = cleaned.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\s*(AM|PM))?)?/i);
  if (numericMatch) {
    const [, part1, part2, part3, hour, minute, second, ampm] = numericMatch;
    const num1 = parseInt(part1, 10);
    const num2 = parseInt(part2, 10);
    const num3 = parseInt(part3, 10);

    // Determine format: DMY, MDY, or YMD
    let year: number, month: number, day: number;

    // Rule 1: If part3 is 4 digits, it's the year
    if (part3.length === 4) {
      year = num3;
      // Now need to determine if part1 is day or month
      // If part1 > 12, it must be day (DMY format: DD.MM.YYYY or DD/MM/YYYY)
      if (num1 > 12) {
        // DMY format: day=part1, month=part2, year=part3
        day = num1;
        month = num2;
      }
      // If part2 > 12, it must be day (MDY format: MM/DD/YYYY)
      else if (num2 > 12) {
        // MDY format: month=part1, day=part2, year=part3
        month = num1;
        day = num2;
      }
      // If part1 is 4 digits, might be YMD format (YYYY-MM-DD already handled in Priority 1)
      // But for consistency, if part1 <= 12 and part2 <= 12, default to DMY
      else {
        // Ambiguous: default to DMY (more common in non-US)
        day = num1;
        month = num2;
      }
    }
    // Rule 2: If part1 is 4 digits, must be YMD format (YYYY-MM-DD already handled in Priority 1)
    // But for safety, handle it here too
    else if (part1.length === 4) {
      year = num1;
      month = num2;
      day = num3;
    }
    // Rule 3: If num1 > 12, must be day (DMY or YMD with 2-digit year)
    else if (num1 > 12) {
      // Assume DMY (more common in non-US)
      year = num3 < 100 ? 2000 + num3 : num3;
      month = num2;
      day = num1;
    }
    // Rule 4: If num2 > 12, must be day (MDY)
    else if (num2 > 12) {
      year = num3 < 100 ? 2000 + num3 : num3;
      month = num1;
      day = num2;
    }
    // Rule 5: If both ≤ 12, default to DMY (more common in non-US)
    else {
      year = num3 < 100 ? 2000 + num3 : num3;
      month = num2;
      day = num1;
    }

    // Parse time
    let timeStr = '00:00:00';
    if (hour && minute) {
      let h = parseInt(hour, 10);
      const m = parseInt(minute, 10);
      const s = second ? parseInt(second, 10) : 0;

      // Handle AM/PM
      if (ampm) {
        const isPM = ampm.toUpperCase() === 'PM';
        if (isPM && h < 12) h += 12;
        if (!isPM && h === 12) h = 0;
      }

      timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Validate date
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        time: timeStr,
      };
    }
  }

  // Priority 3: Text format with month name (Jun 28, 2025, 28 Jun 2025)
  const textMatch = cleaned.match(/([a-zA-Z]{3,9})\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/i) ||
                   cleaned.match(/(\d{1,2})\s+([a-zA-Z]{3,9})\s+(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/i);
  if (textMatch) {
    try {
      const dateObj = new Date(cleaned);
      if (!isNaN(dateObj.getTime())) {
        return {
          date: formatDate(dateObj),
          time: extractTimeFromString(cleaned) || formatTime(dateObj),
        };
      }
    } catch (_e) {
      // Continue to next format
    }
  }

  // Priority 4: Try native Date parsing as fallback
  try {
    const dateObj = new Date(cleaned);
    if (!isNaN(dateObj.getTime())) {
      // Check if date is reasonable (not too far in past/future)
      const year = dateObj.getFullYear();
      if (year >= 2000 && year <= 2100) {
        return {
          date: formatDate(dateObj),
          time: extractTimeFromString(cleaned) || formatTime(dateObj),
        };
      }
    }
  } catch (_e) {
    // Continue to fallback
  }

  // Fallback: Use fallbackDate or return null
  if (fallbackDate) {
    return {
      date: formatDate(fallbackDate),
      time: formatTime(fallbackDate),
    };
  }

  return {
    date: null,
    time: '00:00:00', // Always return string, not null
  };
}

/**
 * Format Date object to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Date object to HH:mm:ss
 */
function formatTime(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${hour}:${minute}:${second}`;
}

/**
 * Extract time string from date string (HH:mm:ss format)
 */
function extractTimeFromString(dateString: string): string | null {
  // Try to find time pattern HH:mm:ss or HH:mm
  const timeMatch = dateString.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?/i);
  if (timeMatch) {
    const [, hour, minute, second, ampm] = timeMatch;
    let h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const s = second ? parseInt(second, 10) : 0;

    // Handle AM/PM
    if (ampm) {
      const isPM = ampm.toUpperCase() === 'PM';
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
    }

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return null;
}

