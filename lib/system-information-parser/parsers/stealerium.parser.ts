// Stealerium parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Stealerium log
 * Format dengan sections:
 *     [IP]
 *     External IP: 119.98.203.64
 *     [Machine]
 *     Username: John
 */
export function parseStealerium(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Stealerium',
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

  let currentSection = '';

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

    // Detect sections
    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
      currentSection = trimmedLine.slice(1, -1).toLowerCase();
      continue;
    }

    // [IP] section
    if (currentSection === 'ip') {
      // External IP: 119.98.203.64
      if (lowerLine.includes('external ip:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }
      // Internal IP: 10.0.2.15 (fallback)
      else if (lowerLine.includes('internal ip:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }
      // Gateway IP: 10.0.2.2
      // Skip, not needed
    }

    // [Machine] section
    if (currentSection === 'machine') {
      // Username: John
      if (lowerLine.startsWith('username:') && !result.username) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.username = cleanValue(extractUsername(value));
        }
      }

      // Compname: DESKTOP-5ABF2TC
      if (lowerLine.startsWith('compname:') && !result.computerName) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.computerName = cleanValue(value);
        }
      }

      // System: Microsoft Windows 10 Pro (64 Bit)
      if (lowerLine.startsWith('system:') && !result.os) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.os = cleanValue(value);
        }
      }

      // CPU: Intel(R) Xeon(R) CPU @ 3.20GHz
      if (lowerLine.startsWith('cpu:') && !result.cpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.cpu = cleanValue(value);
        }
      }

      // GPU: Microsoft Basic Display Adapter
      if (lowerLine.startsWith('gpu:') && !result.gpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.gpu = cleanValue(value);
        }
      }

      // RAM: 4092MB
      if (lowerLine.startsWith('ram:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }

      // DATE: 2024-12-25 7:27:19 AM atau 19/07/2025 17:14:05 (alternatif format)
      // Format bisa dengan atau tanpa signature: "2024-12-25 7:27:19 AM" atau "19/07/2025 17:14:05 (sig:...)"
      if (lowerLine.startsWith('date:') && !result.logDate) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          // Extract date dari format:
          // - Clean format: "2024-12-25 7:27:19 AM" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
          // - With signature: "19/07/2025 17:14:05 (sig:...)" atau "28.06.2025 12:28:40 (sig:...)"
          // - With AM/PM: "2024-12-25 7:27:19 AM"
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
            const dateMatch = value.match(/^([\d\.\/\-\s:]+(?:\s+[AP]M)?)/i);
            if (dateMatch && dateMatch[1].trim().length > 5) {
              result.logDate = cleanValue(dateMatch[1].trim());
            } else {
          result.logDate = cleanValue(value);
            }
          }
        }
      }

      // SCREEN: 1920x1080
      // Skip, not needed

      // BATTERY: NoSystemBattery (100%)
      // Skip, not needed

      // WEBCAMS COUNT: 0
      // Skip, not needed
    }

    // [Virtualization] section
    if (currentSection === 'virtualization') {
      // Antivirus: Windows Defender
      if (lowerLine.startsWith('antivirus:') && !result.antivirus) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.antivirus = cleanValue(value);
        }
      }
      // Other virtualization fields: Skip, not needed
    }

    // [Processes] section
    // Skip, not needed
  }

  return result;
}

