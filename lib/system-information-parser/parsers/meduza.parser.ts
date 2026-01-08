// Meduza parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Meduza log
 * Format: HWID: BF72890FDDFA11EEB512345E6F6E6963E11C7EE3
 *         Log Date: 03-12-2024, 23:45:57
 *         Country Code: US
 */
export function parseMeduza(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Meduza',
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

    // HWID: BF72890FDDFA11EEB512345E6F6E6963E11C7EE3
    if (lowerLine.startsWith('hwid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // Log Date: 03-12-2024, 23:45:57 atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "03-12-2024, 23:45:57" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.includes('log date:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract date dari format:
        // - Clean format: "03-12-2024, 23:45:57" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
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
          const dateMatch = value.match(/^([\d\.\/\-\s:,]+)/);
          if (dateMatch && dateMatch[1].trim().length > 5) {
            result.logDate = cleanValue(dateMatch[1].trim());
          } else {
            result.logDate = cleanValue(value);
          }
        }
      }
    }

    // Build Name: Oxoxox
    // Skip, not needed

    // Country Code: US
    if (lowerLine.includes('country code:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // User Name: John
    if (lowerLine.startsWith('user name:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Computer Name: DESKTOP-5ABF2TC
    if (lowerLine.startsWith('computer name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // Operation System: Windows 10 Home
    if (lowerLine.includes('operation system:') || lowerLine.includes('operating system:')) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Time Zone: [UTC-7:00] US Mountain Standard Time
    // Skip, not needed

    // Screen Resolution: 1920x1080
    // Skip, not needed

    // CPU: AMD Ryzen 5 3500 6-Core Processor , 6 cores
    if (lowerLine.startsWith('cpu:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract CPU name, skip ", 6 cores"
        const cpuMatch = value.match(/^(.+?)(?:\s*,\s*\d+\s+cores?)?$/i);
        if (cpuMatch) {
          result.cpu = cleanValue(cpuMatch[1].trim());
        } else {
          result.cpu = cleanValue(value);
        }
      }
    }

    // GPU: NVIDIA GeForce GTX 1650 SUPER
    if (lowerLine.startsWith('gpu:') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.gpu = cleanValue(value);
      }
    }

    // RAM: 7.91499 GB
    if (lowerLine.startsWith('ram:') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
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

    // Execute Path: C:\Users\acegr\AppData\Local\Temp\9cb5ce.exe
    if (lowerLine.includes('execute path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }
  }

  return result;
}

