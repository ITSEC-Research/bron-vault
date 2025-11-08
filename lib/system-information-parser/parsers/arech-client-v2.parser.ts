// ArechClientV2 parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse ArechClientV2 log
 * Format: IP: 127.0.0.1
 *         FileLocation: C:\Windows\Microsoft.NET\Framework\v4.0.30319\MSBuild.exe
 *         UserName: John
 *         Country: GE
 */
export function parseArechClientV2(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'ArechClientV2',
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

    // IP: 127.0.0.1
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // FileLocation: C:\Windows\Microsoft.NET\Framework\v4.0.30319\MSBuild.exe
    if (lowerLine.startsWith('filelocation:') && !result.filePath) {
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

    // Country: GE
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // HWID: 12F6A3D3C12FE832CE805EB15C38A31A
    if (lowerLine.startsWith('hwid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // Current Language: Russian (Russia)
    // Skip, not needed

    // ScreenSize: {Width = 1536,Height = 864}
    // Skip, not needed

    // TimeZone: (UTC+04:00) Тбилиси
    // Skip, not needed

    // Operation System: Windows 10 Enterprise x64
    if (lowerLine.includes('operation system:') && !result.os) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.os = cleanValue(value);
      }
    }

    // Process Elevation: True
    // Skip, not needed

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
          // Extract dari format "Name: Intel(R) Core(TM) i7-6700HQ CPU @ 2.60GHz, 4 Cores"
          // atau "Name: Intel(R) HD Graphics 530, 1073741824 bytes"
          // atau "Name: NVIDIA GeForce GTX 960M, 4293918720 bytes"
          // atau "Name: Total of RAM, 16211.79 MB or 16999297024 bytes"
          
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

