// XFiles parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse XFiles log
 * Format: Operation ID: 3a0e18ea-e2d2-d347-981f-8d27f710ba3e3a167754-3fe3-716f-ebda-f87f6aac5410
 *         IP: 40.40.186.60
 *         Country: US (United States)
 */
export function parseXFiles(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'XFiles',
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

    // Operation ID: 3a0e18ea-e2d2-d347-981f-8d27f710ba3e3a167754-3fe3-716f-ebda-f87f6aac5410
    // Skip, not needed

    // IP: 40.40.186.60
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // Country: US (United States)
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // Operating System: Windows 10
    if (lowerLine.includes('operating system:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Username: Stanton
    if (lowerLine.startsWith('username:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Computer Name: DESKTOP-T43JEK2
    if (lowerLine.startsWith('computer name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // Hardware ID: 5E30421F690DE01B6E6014007152B83109C02F65
    if (lowerLine.includes('hardware id:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // CPU (Processor): Intel(R) Core(TM) i5-4670 CPU @ 3.40GHz
    if (lowerLine.includes('cpu') && lowerLine.includes('processor') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.cpu = cleanValue(value);
      }
    }

    // GPU (Display Devices): Intel(R) HD Graphics 4600
    if (lowerLine.includes('gpu') && lowerLine.includes('display devices') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.gpu = cleanValue(value);
      }
    }

    // RAM (Memory):
    if (lowerLine.includes('ram') && lowerLine.includes('memory') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ram = cleanValue(value);
      }
    }

    // Screens: 1920x1080
    // Skip, not needed

    // Desktop Screenshot Taken: Yes
    // Skip, not needed

    // Windows Processes [
    // Skip, not needed
  }

  return result;
}

