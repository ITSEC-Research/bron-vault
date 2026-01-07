// CryptBot parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractUsername, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse CryptBot log
 * Format: OS: Windows 10 Pro [ 64-bit ]
 *         Local Date and Time: 2024-12-29 05:37:17 [ UTC: (UTC-08:00) Pacific Time (US & Canada) ]
 *         UserName (ComputerName): Bruno (DESKTOP-ET51AJO)
 */
export function parseCryptBot(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'CryptBot',
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

    // OS: Windows 10 Pro [ 64-bit ]
    if (lowerLine.startsWith('os:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Local Date and Time: 2024-12-29 05:37:17 [ UTC: (UTC-08:00) Pacific Time (US & Canada) ]
    // Format bisa dengan atau tanpa signature: "2024-12-29 05:37:17" atau "2024-12-29 05:37:17 [ UTC: ...]"
    if (lowerLine.includes('local date and time:') || lowerLine.includes('local date:') || lowerLine.includes('date and time:')) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract date dari format:
        // - Clean format: "2024-12-29 05:37:17" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
        // - With signature: "2024-12-29 05:37:17 [ UTC: ...]" atau "19/07/2025 17:14:05 (sig:...)"
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
          // Support both dot (.), slash (/), and dash (-) as date separators
          // Regex akan match seluruh string jika clean, atau stop di karakter invalid (seperti '(' atau '[')
          const dateMatch = value.match(/^([\d\.\/\-\s:]+)/);
          if (dateMatch && dateMatch[1].trim().length > 5) {
          result.logDate = cleanValue(dateMatch[1].trim());
        } else {
          result.logDate = cleanValue(value);
          }
        }
      }
    }

    // UserName (ComputerName): Bruno (DESKTOP-ET51AJO)
    if (lowerLine.includes('username') && lowerLine.includes('computername') && !result.username && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract username dan computer name dari format "Bruno (DESKTOP-ET51AJO)"
        const match = value.match(/^(.+?)\s*\((.+?)\)/);
        if (match) {
          result.username = cleanValue(extractUsername(match[1].trim()));
          result.computerName = cleanValue(match[2].trim());
        } else {
          result.username = cleanValue(extractUsername(value));
        }
      }
    }

    // CPU: Intel(R) Core(TM)CPU @ 2.80GHz [ Сores: 4 ]
    if (lowerLine.startsWith('cpu:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract CPU name, skip [ Сores: 4 ]
        const cpuMatch = value.match(/^(.+?)\s*\[/);
        if (cpuMatch) {
          result.cpu = cleanValue(cpuMatch[1].trim());
        } else {
          result.cpu = cleanValue(value);
        }
      }
    }

    // RAM: 16 Gb
    if (lowerLine.startsWith('ram:') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ram = cleanValue(value);
      }
    }

    // GPU: Microsoft Basic Display Adapter
    if (lowerLine.startsWith('gpu:') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.gpu = cleanValue(value);
      }
    }

    // Display Resolution: 1400 x 1050
    if (lowerLine.includes('display resolution:') || lowerLine.includes('screen resolution:')) {
      // Just skip, we don't store this
      continue;
    }
  }

  return result;
}

