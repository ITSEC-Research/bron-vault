// Banshee parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Banshee log
 * Format: HWID: C9D18A2E-EDA4-5A7A-AB7E-XDNCCLAU35VS
 *         Log Date: 03 September 2024 00:17:30
 *         Build Name: bzPg7NGR1bFjBDl3Sjz9c1C03C2I89
 *         Country Code: US
 */
export function parseBanshee(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Banshee',
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

    // HWID: C9D18A2E-EDA4-5A7A-AB7E-XDNCCLAU35VS
    if (lowerLine.startsWith('hwid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // Log Date: 03 September 2024 00:17:30
    if (lowerLine.includes('log date:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.logDate = cleanValue(value);
      }
    }

    // Build Name: bzPg7NGR1bFjBDl3Sjz9c1C03C2I89
    // Skip, not needed

    // Country Code: US
    if (lowerLine.includes('country code:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // User Name: John Smith (johnsmith)
    if (lowerLine.startsWith('user name:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract username dari format "John Smith (johnsmith)"
        const userMatch = value.match(/^(.+?)(?:\s*\(.+?\))?$/);
        if (userMatch) {
          result.username = cleanValue(extractUsername(userMatch[1].trim()));
        } else {
          result.username = cleanValue(extractUsername(value));
        }
      }
    }

    // Computer Name: John's MacBook Air (2)
    if (lowerLine.startsWith('computer name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // Operation System: macOS 12.6.6 (21G646)
    if (lowerLine.includes('operation system:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Time Zone: UTC-07:00 America/Adak
    // Skip, not needed

    // CPU: Dual-Core Intel Core i5, 1.8 GHz
    if (lowerLine.startsWith('cpu:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract CPU name, skip frequency
        const cpuMatch = value.match(/^(.+?)(?:\s*,\s*\d+\.\d+\s+ghz)?$/i);
        if (cpuMatch) {
          result.cpu = cleanValue(cpuMatch[1].trim());
        } else {
          result.cpu = cleanValue(value);
        }
      }
    }

    // RAM: 8 GB
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
  }

  return result;
}

