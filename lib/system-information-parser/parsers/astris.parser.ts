// Astris stealer parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Astris stealer log (INI-like format)
 * Format: [General], [Machine], [Geolocation], [Hardware]
 */
export function parseAstris(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Astris',
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

    // [General] section
    if (currentSection === 'general') {
      // HWID: 0A256AD07967582CD5A08537A6C57941
      if (lowerLine.startsWith('hwid:') && !result.hwid) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.hwid = cleanValue(value);
        }
      }

      // Date: 10/18/2024 1:51:06 PM
      if (lowerLine.startsWith('date:') && !result.logDate) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.logDate = cleanValue(value);
        }
      }
    }

    // [Machine] section
    if (currentSection === 'machine') {
      // Computer Name: DESKTOP-ET51AJO
      if (lowerLine.startsWith('computer name:') && !result.computerName) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.computerName = cleanValue(value);
        }
      }

      // User Name: Bruno
      if (lowerLine.startsWith('user name:') && !result.username) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.username = cleanValue(extractUsername(value));
        }
      }

      // System: Windows 10 Pro [x64]
      if (lowerLine.startsWith('system:') && !result.os) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.os = cleanValue(value);
        }
      }

      // Antiviruses: Windows Defender
      if (lowerLine.startsWith('antiviruses:') && !result.antivirus) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.antivirus = cleanValue(value);
        }
      }
    }

    // [Geolocation] section
    if (currentSection === 'geolocation') {
      // Country: United States (US)
      if (lowerLine.startsWith('country:') && !result.country) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.country = cleanValue(extractCountryCode(value));
        }
      }
    }

    // [Network] section
    if (currentSection === 'network') {
      // Public IP Address: 34.46.22.199
      if (lowerLine.startsWith('public ip address:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }
      // Private IP Address: 172.16.1.3 (fallback)
      else if (lowerLine.startsWith('private ip address:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }
    }

    // [Hardware] section
    if (currentSection === 'hardware') {
      // CPU: Intel(R) Xeon(R) CPU @ 2.80GHz
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

      // RAM: 4.1 GB
      if (lowerLine.startsWith('ram:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }
    }
  }

  return result;
}

