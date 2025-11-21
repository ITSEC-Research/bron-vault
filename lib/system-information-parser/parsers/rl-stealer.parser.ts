// RL Stealer parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine, extractSectionFromSeparator } from '../helpers';

/**
 * Parse RL Stealer log
 * Format dengan separator sections:
 *     ==================================================
 *     Operating system : Windows Server 2022 Datacenter (64 Bit)
 *     PC user : EC2AMAZ-75HN4R3/Administrator
 *     IP Geolocation : 127.0.0.1 [India]
 */
export function parseRLStealer(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'RL Stealer',
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

    // Operating system : Windows Server 2022 Datacenter (64 Bit)
    if (lowerLine.includes('operating system') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // PC user : EC2AMAZ-75HN4R3/Administrator
    if (lowerLine.includes('pc user') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract username dari format "EC2AMAZ-75HN4R3/Administrator"
        const userMatch = value.match(/\/(.+)$/);
        if (userMatch) {
          result.username = cleanValue(extractUsername(userMatch[1].trim()));
        } else {
          result.username = cleanValue(extractUsername(value));
        }
      }
    }

    // ClipBoard : text
    // Skip, not needed

    // Launch : C:\Users\Administrator\Pictures\rdp_stealer.exe
    if (lowerLine.includes('launch') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }

    // Screen resolution : 600x1256
    // Skip, not needed

    // Current time : 5/22/2023 5:28:14 PM atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "5/22/2023 5:28:14 PM" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.includes('current time') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract time dari format:
        // - Clean format: "5/22/2023 5:28:14 PM" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
        // - With signature: "19/07/2025 17:14:05 (sig:...)" atau "28.06.2025 12:28:40 (sig:...)"
        // - With AM/PM: "5/22/2023 5:28:14 PM"
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
          const timeMatch = value.match(/^([\d\.\/\-\s:]+(?:\s+[AP]M)?)/i);
          if (timeMatch && timeMatch[1].trim().length > 5) {
            result.logDate = cleanValue(timeMatch[1].trim());
          } else {
        result.logDate = cleanValue(value);
          }
        }
      }
    }

    // HWID : 178BFBFF000406F1
    if (lowerLine.includes('hwid') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // CPU : Intel(R) Xeon(R) CPU E5-2686 v4 @ 2.30GHz
    if (lowerLine.startsWith('cpu') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.cpu = cleanValue(value);
      }
    }

    // RAM : 16382MB
    if (lowerLine.startsWith('ram') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ram = cleanValue(value);
      }
    }

    // GPU : Microsoft Basic Display Adapter
    if (lowerLine.startsWith('gpu') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.gpu = cleanValue(value);
      }
    }

    // IP Geolocation : 127.0.0.1 [India]
    if (lowerLine.includes('ip geolocation') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract IP dari format "127.0.0.1 [India]"
        const ipMatch = value.match(/^([\d.]+)/);
        if (ipMatch) {
          result.ipAddress = cleanValue(extractIP(ipMatch[1]));
        }
      }
    }

    // Log Date : 05/22/2023 5:28 atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "05/22/2023 5:28" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.includes('log date') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract date dari format:
        // - Clean format: "05/22/2023 5:28" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
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

    // BSSID : 0a:02:14:dc:54:1e
    // Skip, not needed
  }

  return result;
}

