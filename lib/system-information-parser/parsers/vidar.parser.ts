// Vidar parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Vidar log
 * Format: Ip: [redacted]
 *         Country: [redacted]
 *         Version: 12
 *         [Hardware]
 *         Processor: AMD Phenom(tm) II X6 1090T Processor
 */
export function parseVidar(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Vidar',
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

    // Ip: [redacted]
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // Country: [redacted]
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // Version: 12
    // Skip, not needed

    // Date: [redacted] atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "19/07/2025 17:14:05" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.startsWith('date:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        // Extract date dari format:
        // - Clean format: "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
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
          const dateMatch = value.match(/^([\d\.\/\-\s:]+)/);
          if (dateMatch && dateMatch[1].trim().length > 5) {
            result.logDate = cleanValue(dateMatch[1].trim());
          } else {
        result.logDate = cleanValue(value);
          }
        }
      }
    }

    // MachineID: [redacted]
    if (lowerLine.includes('machineid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.hwid = cleanValue(value);
      }
    }

    // GUID: [redacted]
    // Skip, not needed

    // HWID: [redacted]
    if (lowerLine.startsWith('hwid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.hwid = cleanValue(value);
      }
    }

    // Path: [redacted]
    if (lowerLine.startsWith('path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.filePath = cleanValue(value);
      }
    }

    // Work Dir: In memory
    // Skip, not needed

    // Windows: Windows 10 Pro
    if (lowerLine.startsWith('windows:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Install Date: Disabled
    // Skip, not needed

    // AV: Disabled
    // Skip, not needed

    // Computer Name: [redacted]
    if (lowerLine.startsWith('computer name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.computerName = cleanValue(value);
      }
    }

    // User Name: [redacted]
    if (lowerLine.startsWith('user name:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Display Resolution: 1920x1080
    // Skip, not needed

    // Keyboard Languages: English (United States) / Spanish (Panama)
    // Skip, not needed

    // Local Time: [redacted] atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "19/07/2025 17:14:05" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.includes('local time:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        // Extract time dari format:
        // - Clean format: "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
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

    // TimeZone: -5
    // Skip, not needed

    // [Hardware] section
    if (currentSection === 'hardware') {
      // Processor: AMD Phenom(tm) II X6 1090T Processor
      if (lowerLine.startsWith('processor:') && !result.cpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.cpu = cleanValue(value);
        }
      }

      // Cores: 6
      // Skip, not needed

      // Threads: 6
      // Skip, not needed

      // RAM: 8190 MB
      if (lowerLine.startsWith('ram:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }

      // VideoCard: NVIDIA GeForce 9600 GSO
      if (lowerLine.includes('videocard:') && !result.gpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.gpu = cleanValue(value);
        }
      }
    }

    // [Processes] section
    // Skip, not needed

    // [Software] section
    // Skip, not needed
  }

  return result;
}

