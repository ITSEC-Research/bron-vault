// Astris stealer parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Astris stealer log (INI-like format)
 * Format: [General], [Machine], [Geolocation], [Hardware]
 */
export function parseAstris(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Astris',
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

    // [General] section
    if (currentSection === 'general') {
      // HWID: 0A256AD07967582CD5A08537A6C57941
      if (lowerLine.startsWith('hwid:') && !result.hwid) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.hwid = cleanValue(value);
        }
      }

      // Date: 10/18/2024 1:51:06 PM atau 19/07/2025 17:14:05 (alternatif format)
      // Format bisa dengan atau tanpa signature: "10/18/2024 1:51:06 PM" atau "19/07/2025 17:14:05 (sig:...)"
      if (lowerLine.startsWith('date:') && !result.logDate) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          // Extract date dari format:
          // - Clean format: "10/18/2024 1:51:06 PM" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
          // - With signature: "19/07/2025 17:14:05 (sig:...)" atau "28.06.2025 12:28:40 (sig:...)"
          // - With AM/PM: "10/18/2024 1:51:06 PM"
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
    }

    // [Machine] section
    if (currentSection === 'machine') {
      // Computer Name: DESKTOP-ET51AJO
      if (lowerLine.startsWith('computer name:') && !result.computerName) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.computerName = cleanValue(value);
        }
      }

      // User Name: Bruno
      if (lowerLine.startsWith('user name:') && !result.username) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.username = cleanValue(extractUsername(value));
        }
      }

      // System: Windows 10 Pro [x64]
      if (lowerLine.startsWith('system:') && !result.os) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.os = cleanValue(value);
        }
      }

      // Antiviruses: Windows Defender
      if (lowerLine.startsWith('antiviruses:') && !result.antivirus) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.antivirus = cleanValue(value);
        }
      }
    }

    // [Geolocation] section
    if (currentSection === 'geolocation') {
      // Country: United States (US)
      if (lowerLine.startsWith('country:') && !result.country) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.country = cleanValue(extractCountryCode(value));
        }
      }
    }

    // [Network] section
    if (currentSection === 'network') {
      // Public IP Address: 34.46.22.199
      if (lowerLine.startsWith('public ip address:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }
      // Private IP Address: 172.16.1.3 (fallback)
      else if (lowerLine.startsWith('private ip address:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }
    }

    // [Hardware] section
    if (currentSection === 'hardware') {
      // CPU: Intel(R) Xeon(R) CPU @ 2.80GHz
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

      // RAM: 4.1 GB
      if (lowerLine.startsWith('ram:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }
    }
  }

  return result;
}

