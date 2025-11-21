// DarkCrystal RAT parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse DarkCrystal RAT log
 * Format: PC Name: DESKTOP-5ABF2TC
 *         User Name: John
 *         Windows: Windows Server 2022 Datacenter 64 Bit
 */
export function parseDarkCrystalRAT(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'DarkCrystal RAT',
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

    // PC Name: DESKTOP-5ABF2TC
    if (lowerLine.startsWith('pc name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // User Name: John
    if (lowerLine.startsWith('user name:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Windows: Windows Server 2022 Datacenter 64 Bit
    if (lowerLine.startsWith('windows:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // CPU Name: Unknown (Unknown)
    if (lowerLine.startsWith('cpu name:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
        result.cpu = cleanValue(value);
      }
    }

    // GPU Name: Unknown (Unknown)
    if (lowerLine.startsWith('gpu name:') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
        result.gpu = cleanValue(value);
      }
    }

    // RAM: Unknown
    if (lowerLine.startsWith('ram:') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
        result.ram = cleanValue(value);
      }
    }

    // IP: 127.0.0.1
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // Country: US / United States
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract country code dari format "US / United States"
        const countryMatch = value.match(/^([A-Z]{2})/);
        if (countryMatch) {
          result.country = cleanValue(countryMatch[1]);
        } else {
          result.country = cleanValue(extractCountryCode(value));
        }
      }
    }

    // Save Time: 29.12.2024 23:51 atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "29.12.2024 23:51" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.includes('save time:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract time dari format:
        // - Clean format: "29.12.2024 23:51" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
        // - With signature: "19/07/2025 17:14:05 (sig:...)" atau "28.06.2025 12:28:40 (sig:...)"
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
          // Format numeric, gunakan regex numeric
          const timeMatch = value.match(/^([\d\.\/\-\s:]+)/);
          if (timeMatch && timeMatch[1].trim().length > 5) {
            result.logDate = cleanValue(timeMatch[1].trim());
          } else {
        result.logDate = cleanValue(value);
          }
        }
      }
    }

    // Path: C:\Program Files\WinRAR\System.exe
    if (lowerLine.startsWith('path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }
  }

  return result;
}

