// PredatorTheThief parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse PredatorTheThief log
 * Format: User name: Bruno
 *         Machine name: DESKTOP-AV33AV3
 *         OS version: Windows 10 Enterprise x64
 */
export function parsePredatorTheThief(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'PredatorTheThief',
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

    // User name: Bruno
    if (lowerLine.startsWith('user name:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Machine name: DESKTOP-AV33AV3
    if (lowerLine.startsWith('machine name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // OS version: Windows 10 Enterprise x64
    if (lowerLine.includes('os version:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Launch time: Mon Jan 13 04:21:34 2025
    if (lowerLine.includes('launch time:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.logDate = cleanValue(value);
      }
    }

    // CPU info: Intel(R) Xeon(R) CPU @ 2.80GHz
    if (lowerLine.includes('cpu info:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.cpu = cleanValue(value);
      }
    }

    // Amount of RAM: 17 GB (Current RAM usage: 13258 MB)
    if (lowerLine.includes('amount of ram:') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract RAM size, skip usage info
        const ramMatch = value.match(/^(.+?)(?:\s*\(.+?\))?$/);
        if (ramMatch) {
          result.ram = cleanValue(ramMatch[1].trim());
        } else {
          result.ram = cleanValue(value);
        }
      }
    }

    // GPU info: Microsoft Basic Display Adapter
    if (lowerLine.includes('gpu info:') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.gpu = cleanValue(value);
      }
    }

    // Screen resolution: 1400x1050
    // Skip, not needed

    // Startup folder: C:\Users\Bruno\Desktop\...
    if (lowerLine.includes('startup folder:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }
  }

  return result;
}

