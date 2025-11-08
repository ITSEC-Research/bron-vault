// Stealerium parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Stealerium log
 * Format dengan sections:
 *     [IP]
 *     External IP: 119.98.203.64
 *     [Machine]
 *     Username: John
 */
export function parseStealerium(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Stealerium',
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

    // [IP] section
    if (currentSection === 'ip') {
      // External IP: 119.98.203.64
      if (lowerLine.includes('external ip:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }
      // Internal IP: 10.0.2.15 (fallback)
      else if (lowerLine.includes('internal ip:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }
      // Gateway IP: 10.0.2.2
      // Skip, not needed
    }

    // [Machine] section
    if (currentSection === 'machine') {
      // Username: John
      if (lowerLine.startsWith('username:') && !result.username) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.username = cleanValue(extractUsername(value));
        }
      }

      // Compname: DESKTOP-5ABF2TC
      if (lowerLine.startsWith('compname:') && !result.computerName) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.computerName = cleanValue(value);
        }
      }

      // System: Microsoft Windows 10 Pro (64 Bit)
      if (lowerLine.startsWith('system:') && !result.os) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.os = cleanValue(value);
        }
      }

      // CPU: Intel(R) Xeon(R) CPU @ 3.20GHz
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

      // RAM: 4092MB
      if (lowerLine.startsWith('ram:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }

      // DATE: 2024-12-25 7:27:19 AM
      if (lowerLine.startsWith('date:') && !result.logDate) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.logDate = cleanValue(value);
        }
      }

      // SCREEN: 1920x1080
      // Skip, not needed

      // BATTERY: NoSystemBattery (100%)
      // Skip, not needed

      // WEBCAMS COUNT: 0
      // Skip, not needed
    }

    // [Virtualization] section
    if (currentSection === 'virtualization') {
      // Antivirus: Windows Defender
      if (lowerLine.startsWith('antivirus:') && !result.antivirus) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.antivirus = cleanValue(value);
        }
      }
      // Other virtualization fields: Skip, not needed
    }

    // [Processes] section
    // Skip, not needed
  }

  return result;
}

