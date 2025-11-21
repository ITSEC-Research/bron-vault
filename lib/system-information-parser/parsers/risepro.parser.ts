// RisePro parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse RisePro log
 * Format: Build: default
 *         Version: 2.0
 *         Date: Sat Jul 06 3:43:57 2024
 */
export function parseRisePro(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'RisePro',
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

    // Build: default
    // Skip, not needed

    // Version: 2.0
    // Skip, not needed

    // Date: Sat Jul 06 3:43:57 2024 atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "Sat Jul 06 3:43:57 2024" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.startsWith('date:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract date dari format:
        // - Text format: "Sat Jul 06 3:43:57 2024" atau "29 Jun 25 21:02 CEST"
        // - Numeric format: "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
        // - With signature: "19/07/2025 17:14:05 (sig:...)" atau "28.06.2025 12:28:40 (sig:...)"
        // Cek apakah format mengandung huruf (nama bulan atau timezone)
        const hasLetters = /[a-zA-Z]/.test(value);
        if (hasLetters) {
          // Format dengan nama bulan atau timezone, extract sampai karakter invalid atau akhir string
          // Match berbagai format:
          // - Day first: "29 Jun 25 21:02 CEST" atau "Sat Jul 06 3:43:57 2024"
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

    // MachineID: [redacted]
    if (lowerLine.includes('machineid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.hwid = cleanValue(value);
      }
    }

    // GUID: {553e7197-[redacted]}
    // Skip, not needed

    // HWID: [redacted]
    if (lowerLine.startsWith('hwid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.hwid = cleanValue(value);
      }
    }

    // Path: C:\Windows\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe
    if (lowerLine.startsWith('path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }

    // Work Dir: C:\Users\hp\AppData\Local\Temp\trixyqMFkDNPSFQYy
    // Skip, not needed

    // IP: 127.0.0.1
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // Location: EG, Cairo
    if (lowerLine.startsWith('location:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract country code dari format "EG, Cairo"
        const countryMatch = value.match(/^([A-Z]{2})/);
        if (countryMatch) {
          result.country = cleanValue(countryMatch[1]);
        }
      }
    }

    // ZIP (Autofills): -
    // Skip, not needed

    // Windows: Windows 10 Pro [x64]
    if (lowerLine.startsWith('windows:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Computer Name: DESKTOP-DW129SN [WORKGROUP]
    if (lowerLine.startsWith('computer name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract computer name, skip [WORKGROUP]
        const nameMatch = value.match(/^(.+?)(?:\s*\[.+?\])?$/);
        if (nameMatch) {
          result.computerName = cleanValue(nameMatch[1].trim());
        } else {
          result.computerName = cleanValue(value);
        }
      }
    }

    // User Name: hp
    if (lowerLine.startsWith('user name:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Display Resolution: 1920x1200
    // Skip, not needed

    // Display Language: en-US
    // Skip, not needed

    // Keyboard Languages: English (United States) / Arabic (Egypt)
    // Skip, not needed

    // Local Time: 6/7/2024 3:43:57 atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "6/7/2024 3:43:57" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.includes('local time:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract time dari format:
        // - Clean format: "6/7/2024 3:43:57" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
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
          const timeMatch = value.match(/^([\d\.\/\-\s:]+)/);
          if (timeMatch && timeMatch[1].trim().length > 5) {
            result.logDate = cleanValue(timeMatch[1].trim());
          } else {
        result.logDate = cleanValue(value);
          }
        }
      }
    }

    // TimeZone: UTC2
    // Skip, not needed

    // [Hardware] section
    if (currentSection === 'hardware') {
      // Processor: Intel(R) Core(TM) i7-4770 CPU @ 3.40GHz
      if (lowerLine.startsWith('processor:') && !result.cpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.cpu = cleanValue(value);
        }
      }

      // CPU Count: 8
      // Skip, not needed

      // RAM: 16090 MB
      if (lowerLine.startsWith('ram:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }

      // VideoCard #0: Intel(R) HD Graphics 4600
      if (lowerLine.includes('videocard') && !result.gpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          // Extract GPU name, skip "#0:"
          const gpuMatch = value.match(/^#\d+:\s*(.+)/);
          if (gpuMatch) {
            result.gpu = cleanValue(gpuMatch[1].trim());
          } else {
            result.gpu = cleanValue(value);
          }
        }
      }
    }

    // [Processes] section
    // Skip, not needed
  }

  return result;
}

