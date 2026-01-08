// Blank Grabber parser (Windows systeminfo format)

import { ParsedLogData } from '../types';
import { extractValue, combineOS, cleanValue, extractIP, extractUsername, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Blank Grabber log (Windows systeminfo command output)
 * Format: Host Name: DESKTOP-1PQPCEA
 *         OS Name: Microsoft Windows 10 Pro
 *         OS Version: 10.0.19045 N/A Build 19045
 */
export function parseBlankGrabber(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Blank Grabber',
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

  let osName: string | null = null;
  let osVersion: string | null = null;

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

    // Host Name: DESKTOP-1PQPCEA
    if (lowerLine.startsWith('host name:') && !result.computerName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.computerName = cleanValue(value);
      }
    }

    // OS Name: Microsoft Windows 10 Pro
    if (lowerLine.startsWith('os name:') && !osName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        osName = value;
      }
    }

    // OS Version: 10.0.19045 N/A Build 19045
    if (lowerLine.startsWith('os version:') && !osVersion) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        osVersion = value;
      }
    }

    // Registered Owner: admin
    if (lowerLine.startsWith('registered owner:') && !result.username) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.username = cleanValue(extractUsername(value));
      }
    }

    // Processor(s): 2 Processor(s) Installed. [01]: AMD64 Family 23 Model 113 Stepping 0 AuthenticAMD ~3500 Mhz
    if (lowerLine.startsWith('processor(s):') && !result.cpu) {
      // Cari baris berikutnya yang berisi detail processor
      const lineIndex = lines.indexOf(line);
      if (lineIndex >= 0 && lineIndex < lines.length - 1) {
        const processorLine = lines[lineIndex + 1];
        if (processorLine) {
          const match = processorLine.match(/\[01\]:\s*(.+)/i);
          if (match) {
            result.cpu = cleanValue(match[1].trim());
          }
        }
      }
    }

    // Total Physical Memory: 8,191 MB
    if (lowerLine.startsWith('total physical memory:') && !result.ram) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ram = cleanValue(value);
      }
    }

    // IP address(es) [01]: 192.168.229.128
    if (lowerLine.includes('ip address(es)') && !result.ipAddress) {
      // Cari baris berikutnya yang berisi IP
      const lineIndex = lines.indexOf(line);
      if (lineIndex >= 0 && lineIndex < lines.length - 1) {
        const ipLine = lines[lineIndex + 1];
        if (ipLine) {
          const match = ipLine.match(/\[01\]:\s*([0-9.]+)/);
          if (match) {
            result.ipAddress = cleanValue(extractIP(match[1]));
          }
        }
      }
    }
  }

  // Combine OS Name dan OS Version
  if (osName || osVersion) {
    result.os = cleanValue(combineOS(osName, osVersion));
  }

  return result;
}

