// DarkCrystal RAT parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse DarkCrystal RAT log
 * Format: PC Name: DESKTOP-5ABF2TC
 *         User Name: John
 *         Windows: Windows Server 2022 Datacenter 64 Bit
 */
export function parseDarkCrystalRAT(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'DarkCrystal RAT',
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

    // PC Name: DESKTOP-5ABF2TC
    if (lowerLine.startsWith('pc name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // User Name: John
    if (lowerLine.startsWith('user name:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Windows: Windows Server 2022 Datacenter 64 Bit
    if (lowerLine.startsWith('windows:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // CPU Name: Unknown (Unknown)
    if (lowerLine.startsWith('cpu name:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
        result.cpu = cleanValue(value);
      }
    }

    // GPU Name: Unknown (Unknown)
    if (lowerLine.startsWith('gpu name:') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
        result.gpu = cleanValue(value);
      }
    }

    // RAM: Unknown
    if (lowerLine.startsWith('ram:') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
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

    // Country: US / United States
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract country code dari format "US / United States"
        const countryMatch = value.match(/^([A-Z]{2})/);
        if (countryMatch) {
          result.country = cleanValue(countryMatch[1]);
        } else {
          result.country = cleanValue(extractCountryCode(value));
        }
      }
    }

    // Save Time: 29.12.2024 23:51
    if (lowerLine.includes('save time:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.logDate = cleanValue(value);
      }
    }

    // Path: C:\Program Files\WinRAR\System.exe
    if (lowerLine.startsWith('path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }
  }

  return result;
}

