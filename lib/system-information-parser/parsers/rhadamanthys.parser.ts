// Rhadamanthys parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Rhadamanthys log
 * Format: Install Date: 09 Dec 23 00:33 UTC
 *         Traffic Name: 001FT-35
 *         HWID: [redacted]
 */
export function parseRhadamanthys(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Rhadamanthys',
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

    // Install Date: 09 Dec 23 00:33 UTC atau 19/07/2025 17:14:05 (alternatif format)
    // Format bisa dengan atau tanpa signature: "09 Dec 23 00:33 UTC" atau "19/07/2025 17:14:05 (sig:...)"
    if (lowerLine.includes('install date:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract date dari format:
        // - Text format: "09 Dec 23 00:33 UTC" atau "29 Jun 25 21:02 CEST"
        // - Numeric format: "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
        // - With signature: "19/07/2025 17:14:05 (sig:...)" atau "28.06.2025 12:28:40 (sig:...)"
        // Cek apakah format mengandung huruf (nama bulan atau timezone)
        const hasLetters = /[a-zA-Z]/.test(value);
        if (hasLetters) {
          // Format dengan nama bulan atau timezone, extract sampai karakter invalid atau akhir string
          // Match berbagai format:
          // - Day first: "29 Jun 25 21:02 CEST" atau "09 Dec 23 00:33 UTC"
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

    // Traffic Name: 001FT-35
    // Skip, not needed

    // HWID: [redacted]
    if (lowerLine.startsWith('hwid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.hwid = cleanValue(value);
      }
    }

    // IP: 127.0.0.1
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // Country: CA
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // Time Zone: UTC-5
    // Skip, not needed

    // System Language: Japanese
    // Skip, not needed

    // User Language: English
    // Skip, not needed

    // Keyboard Language: English
    // Skip, not needed

    // Processor: Intel(R) Core(TM) i9-10850K CPU @ 3.60GHz
    if (lowerLine.startsWith('processor:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.cpu = cleanValue(value);
      }
    }

    // Installed RAM: 32658 MB
    if (lowerLine.includes('installed ram:') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ram = cleanValue(value);
      }
    }

    // OS: Windows 10 build 19045 (64 Bit)
    if (lowerLine.startsWith('os:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Video card: NVIDIA GeForce RTX 3080
    if (lowerLine.includes('video card:') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.gpu = cleanValue(value);
      }
    }

    // Display Resolution: 2560x1440
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

    // Domain Name: DOMAIN
    // Skip, not needed

    // MachineID: [redacted]
    if (lowerLine.includes('machineid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.hwid = cleanValue(value);
      }
    }

    // WallPaper Hash: [40 char string]
    // Skip, not needed
  }

  return result;
}

