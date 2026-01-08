// Raccoon parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Raccoon log
 * Format dengan separator sections:
 *     System Information:
 *       - System Language: Polish
 *       - IP: 80.238.108.168
 *       - ComputerName: MARIO-KOMPUTER
 */
export function parseRaccoon(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Raccoon',
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

  let inSystemInfoSection = false;
  let inDisplayDevicesSection = false;
  const gpuList: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Skip separator lines
    if (isSeparatorLine(trimmedLine)) {
      // Reset section flags
      inSystemInfoSection = false;
      inDisplayDevicesSection = false;
      continue;
    }

    // Normalize: remove dash prefix dan indent/tab jika ada
    const normalizedLine = normalizeLine(trimmedLine);
    const lowerLine = normalizedLine.toLowerCase();

    // Detect sections
    if (lowerLine.includes('system information:') || lowerLine.includes('system info:')) {
      inSystemInfoSection = true;
      continue;
    }

    if (lowerLine.includes('display devices:') || lowerLine.includes('display device:')) {
      inDisplayDevicesSection = true;
      continue;
    }

    // [System Information] section
    if (inSystemInfoSection) {
      // - System Language: Polish
      // - System TimeZone: +1 hrs
      // - IP: 80.238.108.168
      if (lowerLine.startsWith('ip:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }

      // - Location: 52.273998, 21.083700 | Warsaw, Mazovia, Poland (03-890)
      if (lowerLine.startsWith('location:') && !result.country) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          // Extract country dari format "Warsaw, Mazovia, Poland (03-890)"
          const countryMatch = value.match(/,\s*([^,]+)\s*\(/);
          if (countryMatch) {
            result.country = cleanValue(extractCountryCode(countryMatch[1].trim()));
          }
        }
      }

      // - ComputerName: MARIO-KOMPUTER
      if (lowerLine.includes('computername:') && !result.computerName) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.computerName = cleanValue(value);
        }
      }

      // - Username: Mario
      if (lowerLine.startsWith('username:') && !result.username) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.username = cleanValue(extractUsername(value));
        }
      }

      // - Windows version: NT 6.1
      // - Product name: Windows 7 Home Premium
      if (lowerLine.includes('product name:') && !result.os) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.os = cleanValue(value);
        }
      } else if (lowerLine.includes('os:') && !result.os) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.os = cleanValue(value);
        }
      }

      // - System arch: x32
      // Skip, not needed

      // - CPU: Intel(R) Core(TM) i5-5200U CPU @ 2.20GHz (4 cores)
      if (lowerLine.startsWith('cpu:') && !result.cpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          // Extract CPU name, skip cores info
          const cpuMatch = value.match(/^(.+?)(?:\s*\(\d+\s+cores?\))?$/i);
          if (cpuMatch) {
            result.cpu = cleanValue(cpuMatch[1].trim());
          } else {
            result.cpu = cleanValue(value);
          }
        }
      }

      // - RAM: 3055 MB (1554 MB used)
      if (lowerLine.startsWith('ram:') && !result.ram) {
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

      // - Screen resolution: 1366x768
      // Skip, not needed
    }

    // [Display Devices] section
    if (inDisplayDevicesSection) {
      // 0) Intel(R) HD Graphics 5500
      if (trimmedLine.match(/^\d+\)\s+/)) {
        const gpuValue = trimmedLine.replace(/^\d+\)\s+/, '').trim();
        if (gpuValue && !gpuValue.toLowerCase().includes('gpu:')) {
          gpuList.push(gpuValue);
        }
        continue;
      } else {
        // Keluar dari section jika tidak ada pattern lagi
        inDisplayDevicesSection = false;
        if (gpuList.length > 0 && !result.gpu) {
          result.gpu = cleanValue(gpuList[0]);
        }
      }
    }

    // Alternative format: IP info: PL 31.60.52.174
    if (lowerLine.includes('ip info:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Extract IP dari format "PL 31.60.52.174"
        const ipMatch = value.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
          result.ipAddress = cleanValue(extractIP(ipMatch[1]));
        }
      }
    }

    // Alternative format: Architecture: x64
    // Skip, not needed
  }

  // Finalize GPU jika masih dalam section
  if (inDisplayDevicesSection && gpuList.length > 0 && !result.gpu) {
    result.gpu = cleanValue(gpuList[0]);
  }

  return result;
}

