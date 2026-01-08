// StealC parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse StealC log
 * Format dengan sections:
 *     Network Info:
 *       - IP: 122.161.XXX.XX
 *       - Country: IN
 *     System Summary:
 *       - HWID: G5NGOT9X695ZPKPW0RQSPS
 */
export function parseStealC(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'StealC',
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
    if (lowerLine.includes('network info:') || lowerLine.includes('network info')) {
      currentSection = 'network';
      continue;
    }

    if (lowerLine.includes('system summary:') || lowerLine.includes('system summary')) {
      currentSection = 'system';
      continue;
    }

    // [Network Info] section
    if (currentSection === 'network') {
      // - IP: 122.161.XXX.XX
      if (lowerLine.startsWith('ip:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }

      // - Country: IN
      if (lowerLine.startsWith('country:') && !result.country) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.country = cleanValue(extractCountryCode(value));
        }
      }
    }

    // [System Summary] section
    if (currentSection === 'system') {
      // - HWID: G5NGOT9X695ZPKPW0RQSPS
      if (lowerLine.startsWith('hwid:') && !result.hwid) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.hwid = cleanValue(value);
        }
      }

      // - OS: Windows 10 Pro
      if (lowerLine.startsWith('os:') && !result.os) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.os = cleanValue(value);
        }
      }

      // - Architecture: x64
      // Skip, not needed

      // - UserName: John
      if (lowerLine.startsWith('username:') && !result.username) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.username = cleanValue(extractUsername(value));
        }
      }

      // - Computer Name: DESKTOP-5ABF2TC
      if (lowerLine.startsWith('computer name:') && !result.computerName) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.computerName = cleanValue(value);
        }
      }

      // - Local Time: 2024/6/22 15:49:7 atau 19/07/2025 17:14:05 (alternatif format)
      // Format bisa dengan atau tanpa signature: "2024/6/22 15:49:7" atau "19/07/2025 17:14:05 (sig:...)"
      if (lowerLine.includes('local time:') && !result.logDate) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          // Extract time dari format:
          // - Clean format: "2024/6/22 15:49:7" atau "28.06.2025 12:28:40" atau "19/07/2025 17:14:05"
          // - With signature: "19/07/2025 17:14:05 (sig:...)" atau "28.06.2025 12:28:40 (sig:...)"
          // - With month name: "29 Jun 25 21:02 CEST" atau "03 September 2024 00:17:30"
          // Cek apakah format mengandung huruf (nama bulan atau timezone)
          const hasLetters = /[a-zA-Z]/.test(value);
          if (hasLetters) {
            // Format dengan nama bulan atau timezone, extract sampai karakter invalid atau akhir string
            // Match berbagai format:
            // - Day first: "29 Jun 25 21:02 CEST" atau "03 September 2024 00:17:30"
            // - Month first: "Jun 29, 25 21:02 CEST" atau "Jun 29, 2025 21:02 CEST"
            // Pattern: (day + month + year) atau (month + day + year) + time + optional timezone
            // Coba match format dengan hari di depan dulu, lalu format dengan bulan di depan
            const dayFirstMatch = value.match(/^([\d]+\s+\w+\s+[\d\s:]+(?:\s+[A-Z]{2,})?)/i);
            const monthFirstMatch = value.match(/^(\w+\s+[\d]+,?\s+[\d\s:]+(?:\s+[A-Z]{2,})?)/i);
            const textDateMatch = dayFirstMatch || monthFirstMatch;
            if (textDateMatch && textDateMatch[1].trim().length > 5) {
              result.logDate = cleanValue(textDateMatch[1].trim());
            } else {
              // Fallback: extract sampai karakter invalid atau ambil seluruh value
              const untilInvalid = value.match(/^([^(\[]+)/);
              if (untilInvalid && untilInvalid[1].trim().length > 5) {
                result.logDate = cleanValue(untilInvalid[1].trim());
              } else {
                result.logDate = cleanValue(value);
              }
            }
          } else {
            // Format numeric, gunakan regex numeric
            // Support both dot (.), slash (/), and dash (-) as date separators
            // Regex akan match seluruh string jika clean, atau stop di karakter invalid (seperti '(' atau '[')
            const timeMatch = value.match(/^([\d\.\/\-\s:]+)/);
            if (timeMatch && timeMatch[1].trim().length > 5) {
              result.logDate = cleanValue(timeMatch[1].trim());
            } else {
          result.logDate = cleanValue(value);
            }
          }
        }
      }

      // - UTC: 5
      // Skip, not needed

      // - Language: en-IN
      // Skip, not needed

      // - Keyboards: English (United States)
      // Skip, not needed

      // - Laptop: TRUE
      // Skip, not needed

      // - Running Path: C:\Windows\SysWOW64\explorer.exe
      if (lowerLine.includes('running path:') && !result.filePath) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.filePath = cleanValue(value);
        }
      }

      // - CPU: Intel(R) Core(TM) i5-5300U CPU @ 2.30GHz
      if (lowerLine.startsWith('cpu:') && !result.cpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.cpu = cleanValue(value);
        }
      }

      // - Cores: 2
      // Skip, not needed

      // - Threads: 4
      // Skip, not needed

      // - RAM: 3971 MB
      if (lowerLine.startsWith('ram:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }

      // - Display Resolution: 1600x900
      // Skip, not needed

      // - GPU:
      //     -Intel(R) HD Graphics 5500
      if (lowerLine.startsWith('gpu:') && !result.gpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.gpu = cleanValue(value);
        } else {
          // GPU value ada di baris berikutnya dengan indent
          continue;
        }
      }

      // Handle GPU list items (indented dengan dash)
      // Format: "  -Intel(R) HD Graphics 5500" (indented dengan dash)
      if (currentSection === 'system' && !result.gpu) {
        const isIndented = line.startsWith('  ') || line.startsWith('\t');
        const hasDashPrefix = trimmedLine.startsWith('-');
        
        if (isIndented && hasDashPrefix) {
          const gpuValue = trimmedLine.replace(/^-\s*/, '').trim();
          if (gpuValue && gpuValue.length > 0 && !gpuValue.toLowerCase().includes('gpu:')) {
            result.gpu = cleanValue(gpuValue);
          }
        }
      }
    }
  }

  return result;
}

