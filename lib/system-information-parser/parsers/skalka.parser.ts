// Skalka parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Skalka log
 * Format: Operation System: win10-amd64
 *         Current JarFile Path: C:/Users/WDAGUtilityAccount/AppData/Local/Temp/svchost.jar
 *         UserName: WDAGUtilityAccount
 */
export function parseSkalka(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Skalka',
    os: null,
    ipAddress: null,
    username: null,
    cpu: null,
    ram: null,
    computerName: null,
    gpu: null,
    country: null,
    logDate: null,
    hwid: null,
    filePath: null,
    antivirus: null,
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Skip separator lines
    if (isSeparatorLine(trimmedLine)) {
      continue;
    }

    // Normalize: remove dash prefix dan indent/tab jika ada
    const normalizedLine = normalizeLine(trimmedLine);
    const lowerLine = normalizedLine.toLowerCase();

    // Operation System: win10-amd64
    if (lowerLine.includes('operation system:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Convert "win10-amd64" to more readable format
        const osValue = value.replace(/^win(\d+)/i, 'Windows $1');
        result.os = cleanValue(osValue);
      }
    }

    // Current JarFile Path: C:/Users/WDAGUtilityAccount/AppData/Local/Temp/svchost.jar
    if (lowerLine.includes('current jarfile path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Convert forward slashes to backslashes for consistency
        const pathValue = value.replace(/\//g, '\\');
        result.filePath = cleanValue(pathValue);
      }
    }

    // UserName: WDAGUtilityAccount
    if (lowerLine.startsWith('username:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // IP: 95.135.28.223
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // TimeZone: 2024-09-29T02:31:56.696+03:00 [Europe/Moscow]
    // Format bisa dengan atau tanpa signature: "2024-09-29T02:31:56.696+03:00" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.startsWith('timezone:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract date dari format:
        // - Clean format: "2024-09-29T02:31:56.696+03:00" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
        // - With signature: "2024-09-29T02:31:56.696+03:00 [Europe/Moscow]" atau "19/07/2025 17:14:05 (sig:...)"
        // - With month name: "29 Jun 25 21:02 CEST" atau "03 September 2024 00:17:30"
        // Cek apakah format mengandung huruf (nama bulan atau timezone)
        const hasLetters = /[a-zA-Z]/.test(value);
        if (hasLetters) {
          // Format dengan nama bulan atau timezone, extract sampai karakter invalid atau akhir string
          // Match berbagai format:
          // - Day first: "29 Jun 25 21:02 CEST" atau "03 September 2024 00:17:30"
          // - Month first: "Jun 29, 25 21:02 CEST" atau "Jun 29, 2025 21:02 CEST"
          // Pattern: (day + month + year) atau (month + day + year) + time + optional timezone
          // Coba match format dengan hari di depan dulu, lalu format dengan bulan di depan
          const dayFirstMatch = value.match(/^([\d]+\s+\w+\s+[\d\s:]+(?:\s+[A-Z]{2,})?)/i);
          const monthFirstMatch = value.match(/^(\w+\s+[\d]+,?\s+[\d\s:]+(?:\s+[A-Z]{2,})?)/i);
          const textDateMatch = dayFirstMatch || monthFirstMatch;
          if (textDateMatch && textDateMatch[1].trim().length > 5) {
            result.logDate = cleanValue(textDateMatch[1].trim());
          } else {
            // Fallback: extract sampai karakter invalid atau ambil seluruh value
            const untilInvalid = value.match(/^([^(\[]+)/);
            if (untilInvalid && untilInvalid[1].trim().length > 5) {
              result.logDate = cleanValue(untilInvalid[1].trim());
            } else {
              result.logDate = cleanValue(value);
            }
          }
        } else {
          // Format numeric atau ISO, gunakan regex numeric
          // Support both dot (.), slash (/), dash (-), and T separator for ISO format
          // Regex akan match seluruh string jika clean, atau stop di karakter invalid (seperti '(' atau '[')
          const dateMatch = value.match(/^([\d\.\/\-T\s:]+)/);
          if (dateMatch && dateMatch[1].trim().length > 5) {
          result.logDate = cleanValue(dateMatch[1].trim());
        } else {
          result.logDate = cleanValue(value);
          }
        }
      }
    }

    // Width: 1076.0, Height: 533.0
    // Skip, not needed

    // Language & Country: ru_RU
    if (lowerLine.includes('language & country:') || lowerLine.includes('language and country:')) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract country code dari format "ru_RU"
        const countryMatch = value.match(/_([A-Z]{2})$/);
        if (countryMatch) {
          result.country = cleanValue(countryMatch[1]);
        } else {
          result.country = cleanValue(extractCountryCode(value));
        }
      }
    }
  }

  return result;
}

