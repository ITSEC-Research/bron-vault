// RedLine/META parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse RedLine/META log
 * Format: Build ID: TG
 *         IP: 127.0.0.1
 *         UserName: John
 *         MachineName: DESKTOP-I5DF3AA
 */
export function parseRedLineMETA(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'RedLine/META',
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

  let isInHardwaresSection = false;
  let isInAntiVirusSection = false;
  const hardwareList: string[] = [];
  const antivirusList: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      isInHardwaresSection = false;
      isInAntiVirusSection = false;
      continue;
    }

    // Skip separator lines
    if (isSeparatorLine(trimmedLine)) {
      continue;
    }

    // Normalize: remove dash prefix dan indent/tab jika ada
    const normalizedLine = normalizeLine(trimmedLine);
    const lowerLine = normalizedLine.toLowerCase();

    // Build ID: TG
    // Skip, not needed

    // IP: 127.0.0.1
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // FileLocation: C:\Users\Soliman\AppData\Roaming\LqKC6wx1X7.exe
    if (lowerLine.includes('filelocation:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }

    // UserName: John
    if (lowerLine.startsWith('username:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // MachineName: DESKTOP-I5DF3AA
    if (lowerLine.startsWith('machinename:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // Country: AE
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // Zip Code: UNKNOWN
    // Skip, not needed

    // Location: Dubai, Dubayy
    // Skip, not needed

    // HWID: 122C51E4AF1735E9123E2A94C1AC26A0D
    if (lowerLine.startsWith('hwid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // Current Language: English (United States)
    // Skip, not needed

    // ScreenSize: {Width=1536, Height=864}
    // Skip, not needed

    // TimeZone: (UTC+04:00) Abu Dhabi, Muscat
    // Skip, not needed

    // Operation System: Windows 10 Pro x64
    if (lowerLine.includes('operation system:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Log date: 7/4/2024 5:43:07 PM
    if (lowerLine.includes('log date:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.logDate = cleanValue(value);
      }
    }

    // Available KeyboardLayouts:
    // Skip, not needed

    // Hardwares:
    if (lowerLine.includes('hardwares:') || lowerLine.includes('hardware:')) {
      isInHardwaresSection = true;
      continue;
    }

    // Handle Hardware list items
    if (isInHardwaresSection) {
      if (lowerLine.startsWith('name:')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          // Extract dari format "Name: Total of RAM, 8087.34 Mb or 8480190464 bytes"
          // atau "Name: Intel(R) Core(TM) i5-6300U CPU @ 2.40GHz, 2 Cores"
          // atau "Name: Intel(R) HD Graphics 520, 1073741824 bytes"
          
          if (value.toLowerCase().includes('total of ram') || value.toLowerCase().includes('ram')) {
            // Extract RAM
            const ramMatch = value.match(/(\d+\.?\d*)\s*(mb|gb|bytes)/i);
            if (ramMatch && !result.ram) {
              result.ram = cleanValue(`${ramMatch[1]} ${ramMatch[2].toUpperCase()}`);
            }
          } else if (value.toLowerCase().includes('cpu') || value.toLowerCase().includes('processor')) {
            // Extract CPU
            if (!result.cpu) {
              const cpuMatch = value.match(/^(.+?)(?:\s*,\s*\d+\s+cores?)?$/i);
              if (cpuMatch) {
                result.cpu = cleanValue(cpuMatch[1].trim());
              } else {
                result.cpu = cleanValue(value);
              }
            }
          } else if (value.toLowerCase().includes('graphics') || value.toLowerCase().includes('gpu')) {
            // Extract GPU
            if (!result.gpu) {
              const gpuMatch = value.match(/^(.+?)(?:\s*,\s*\d+\s+bytes)?$/i);
              if (gpuMatch) {
                result.gpu = cleanValue(gpuMatch[1].trim());
              } else {
                result.gpu = cleanValue(value);
              }
            }
          }
        }
        continue;
      } else {
        // Keluar dari section jika tidak ada pattern lagi
        isInHardwaresSection = false;
      }
    }

    // Anti-Viruses:
    if (lowerLine.includes('anti-viruses:') || lowerLine.includes('antiviruses:')) {
      isInAntiVirusSection = true;
      continue;
    }

    // Handle Anti Virus list items
    if (isInAntiVirusSection) {
      if (trimmedLine && !trimmedLine.toLowerCase().includes('anti-viruses:') && !trimmedLine.toLowerCase().includes('antiviruses:')) {
        const avValue = normalizedLine;
        if (avValue && avValue.trim()) {
          antivirusList.push(avValue);
        }
        continue;
      } else {
        // Keluar dari section jika tidak ada pattern lagi
        isInAntiVirusSection = false;
        if (antivirusList.length > 0 && !result.antivirus) {
          result.antivirus = cleanValue(antivirusList.join(', '));
        }
      }
    }
  }

  // Finalize Anti Virus jika masih dalam section
  if (isInAntiVirusSection && antivirusList.length > 0 && !result.antivirus) {
    result.antivirus = cleanValue(antivirusList.join(', '));
  }

  return result;
}

