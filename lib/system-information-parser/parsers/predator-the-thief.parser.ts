// PredatorTheThief parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractUsername, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse PredatorTheThief log
 * Format: User name: Bruno
 *         Machine name: DESKTOP-AV33AV3
 *         OS version: Windows 10 Enterprise x64
 */
export function parsePredatorTheThief(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'PredatorTheThief',
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

    // User name: Bruno
    if (lowerLine.startsWith('user name:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Machine name: DESKTOP-AV33AV3
    if (lowerLine.startsWith('machine name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // OS version: Windows 10 Enterprise x64
    if (lowerLine.includes('os version:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Launch time: Mon Jan 13 04:21:34 2025 atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "Mon Jan 13 04:21:34 2025" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.includes('launch time:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract time dari format:
        // - Text format: "Mon Jan 13 04:21:34 2025" atau "29 Jun 25 21:02 CEST"
        // - Numeric format: "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
        // - With signature: "19/07/2025 17:14:05 (sig:...)" atau "28.06.2025 12:28:40 (sig:...)"
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
          const timeMatch = value.match(/^([\d\.\/\-\s:]+(?:\s+[AP]M)?)/i);
          if (timeMatch && timeMatch[1].trim().length > 5) {
            result.logDate = cleanValue(timeMatch[1].trim());
          } else {
        result.logDate = cleanValue(value);
          }
        }
      }
    }

    // CPU info: Intel(R) Xeon(R) CPU @ 2.80GHz
    if (lowerLine.includes('cpu info:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.cpu = cleanValue(value);
      }
    }

    // Amount of RAM: 17 GB (Current RAM usage: 13258 MB)
    if (lowerLine.includes('amount of ram:') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract RAM size, skip usage info
        const ramMatch = value.match(/^(.+?)(?:\s*\(.+?\))?$/);
        if (ramMatch) {
          result.ram = cleanValue(ramMatch[1].trim());
        } else {
          result.ram = cleanValue(value);
        }
      }
    }

    // GPU info: Microsoft Basic Display Adapter
    if (lowerLine.includes('gpu info:') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.gpu = cleanValue(value);
      }
    }

    // Screen resolution: 1400x1050
    // Skip, not needed

    // Startup folder: C:\Users\Bruno\Desktop\...
    if (lowerLine.includes('startup folder:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }
  }

  return result;
}

