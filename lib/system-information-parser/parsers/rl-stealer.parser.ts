// RL Stealer parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine, extractSectionFromSeparator } from '../helpers';

/**
 * Parse RL Stealer log
 * Format dengan separator sections:
 *     ==================================================
 *     Operating system : Windows Server 2022 Datacenter (64 Bit)
 *     PC user : EC2AMAZ-75HN4R3/Administrator
 *     IP Geolocation : 127.0.0.1 [India]
 */
export function parseRLStealer(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'RL Stealer',
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

    // Operating system : Windows Server 2022 Datacenter (64 Bit)
    if (lowerLine.includes('operating system') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // PC user : EC2AMAZ-75HN4R3/Administrator
    if (lowerLine.includes('pc user') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract username dari format "EC2AMAZ-75HN4R3/Administrator"
        const userMatch = value.match(/\/(.+)$/);
        if (userMatch) {
          result.username = cleanValue(extractUsername(userMatch[1].trim()));
        } else {
          result.username = cleanValue(extractUsername(value));
        }
      }
    }

    // ClipBoard : text
    // Skip, not needed

    // Launch : C:\Users\Administrator\Pictures\rdp_stealer.exe
    if (lowerLine.includes('launch') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }

    // Screen resolution : 600x1256
    // Skip, not needed

    // Current time : 5/22/2023 5:28:14 PM
    if (lowerLine.includes('current time') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.logDate = cleanValue(value);
      }
    }

    // HWID : 178BFBFF000406F1
    if (lowerLine.includes('hwid') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // CPU : Intel(R) Xeon(R) CPU E5-2686 v4 @ 2.30GHz
    if (lowerLine.startsWith('cpu') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.cpu = cleanValue(value);
      }
    }

    // RAM : 16382MB
    if (lowerLine.startsWith('ram') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ram = cleanValue(value);
      }
    }

    // GPU : Microsoft Basic Display Adapter
    if (lowerLine.startsWith('gpu') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.gpu = cleanValue(value);
      }
    }

    // IP Geolocation : 127.0.0.1 [India]
    if (lowerLine.includes('ip geolocation') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract IP dari format "127.0.0.1 [India]"
        const ipMatch = value.match(/^([\d.]+)/);
        if (ipMatch) {
          result.ipAddress = cleanValue(extractIP(ipMatch[1]));
        }
      }
    }

    // Log Date : 05/22/2023 5:28
    if (lowerLine.includes('log date') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.logDate = cleanValue(value);
      }
    }

    // BSSID : 0a:02:14:dc:54:1e
    // Skip, not needed
  }

  return result;
}

