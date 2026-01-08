// Noxty parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Noxty log
 * Format: User: 123716
 *         Operating System: Microsoft Windows 10 Pro   10.0.17134
 *         CPU: Intel   Celeron® G6900, Intel Celeron G6900   2.59 GHz
 */
export function parseNoxty(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Noxty',
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

    // User: 123716
    if (lowerLine.startsWith('user:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Operating System: Microsoft Windows 10 Pro   10.0.17134
    if (lowerLine.includes('operating system:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Process Executable Path: C:\Users\george\AppData\Local\Temp\...
    if (lowerLine.includes('process executable path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }

    // Uptime: 1 hours, 12 minutes, 35 seconds
    // Skip, not needed

    // CPU: Intel   Celeron® G6900, Intel Celeron G6900   2.59 GHz
    if (lowerLine.startsWith('cpu:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract CPU name, skip frequency
        const cpuMatch = value.match(/^(.+?)(?:\s+\d+\.\d+\s+ghz)?$/i);
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

    // GPU: 2YYYT  (1024 MB)
    if (lowerLine.startsWith('gpu:') && !result.gpu) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract GPU name, skip memory info
        const gpuMatch = value.match(/^(.+?)(?:\s*\(.+?\))?$/);
        if (gpuMatch) {
          result.gpu = cleanValue(gpuMatch[1].trim());
        } else {
          result.gpu = cleanValue(value);
        }
      }
    }

    // ScreenResolution: 1024x768
    // Skip, not needed

    // Serial Number: 00330-80000-00000-AA154
    if (lowerLine.includes('serial number:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // Disk Devices: C:   208.15 GB
    // Skip, not needed

    // IP: 34.17.55.59
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // Country: Italy
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // City: Turin
    // Region: Piedmont
    // ISP: GOOGLE-CLOUD-PLATFORM
    // Latitude: 45.0705
    // Longitude: 7.6868
    // Timezone: Europe/Rome
    // Skip, not needed
  }

  return result;
}

