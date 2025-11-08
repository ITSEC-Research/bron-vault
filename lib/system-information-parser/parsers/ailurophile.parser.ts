// Ailurophile parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Ailurophile log
 * Format: IP: [redacted]
 *         Country: [redacted]
 *         Hostname: [redacted]
 *         PC Type: Microsoft Windows [redacted]
 */
export function parseAilurophile(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Ailurophile',
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

    // IP: [redacted]
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

    // Hostname: [redacted]
    if (lowerLine.startsWith('hostname:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.computerName = cleanValue(value);
      }
    }

    // PC Type: Microsoft Windows [redacted]
    if (lowerLine.includes('pc type:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.os = cleanValue(value);
      }
    }

    // Architecture: amd64
    // Skip, not needed

    // File Path: C:\Users\[redacted]\AppData\Local\Temp
    if (lowerLine.includes('file path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim() && !value.toLowerCase().includes('[redacted]')) {
        result.filePath = cleanValue(value);
      }
    }

    // Main Path: C:\Users\[redacted]\AppData\Local\Ailurophile
    // Skip, not needed

    // Allowed Extensions: [rdp txt doc docx pdf csv xls xlsx keys ldb log]
    // Skip, not needed

    // Folders to Search: [Documents Desktop Downloads]
    // Skip, not needed

    // Files: [bank info casino prv privé prive telegram personnel trading bitcoin sauvegarde funds recup note]
    // Skip, not needed

    // MAC Address: [redacted]
    // Skip, not needed

    // Screen Resolution: [redacted]
    // Skip, not needed

    // Browsers:
    //   Chrome Default - version: [version string]
    //   Edge Default - version: [version string]
    // Skip, not needed
  }

  return result;
}

