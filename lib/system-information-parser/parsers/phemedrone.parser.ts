// Phemedrone parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine, extractSectionFromSeparator } from '../helpers';

/**
 * Parse Phemedrone log
 * Format dengan separator sections:
 *     ----- Geolocation Data -----
 *     IP: 127.0.0.1
 *     Country: Russia (RU)
 *     ----- Hardware Info -----
 *     Username: Administrator\ZTLRFZYKCOID
 *     Windows name: Windows Server 2016 Standard x64
 */
export function parsePhemedrone(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Phemedrone',
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

    // Skip separator lines dan extract section name
    if (isSeparatorLine(trimmedLine)) {
      const sectionName = extractSectionFromSeparator(trimmedLine);
      if (sectionName) {
        currentSection = sectionName.toLowerCase();
        // Normalize section name
        if (currentSection.includes('geolocation')) {
          currentSection = 'geolocation';
        } else if (currentSection.includes('hardware')) {
          currentSection = 'hardware';
        } else if (currentSection.includes('report')) {
          currentSection = 'report';
        } else if (currentSection.includes('miscellaneous')) {
          currentSection = 'miscellaneous';
        }
      }
      continue;
    }

    // Normalize: remove dash prefix dan indent/tab jika ada
    const normalizedLine = normalizeLine(trimmedLine);
    const lowerLine = normalizedLine.toLowerCase();

    // [Geolocation Data] section
    if (currentSection === 'geolocation') {
      // IP: 127.0.0.1
      if (lowerLine.startsWith('ip:') && !result.ipAddress) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ipAddress = cleanValue(extractIP(value));
        }
      }

      // Country: Russia (RU)
      if (lowerLine.startsWith('country:') && !result.country) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.country = cleanValue(extractCountryCode(value));
        }
      }

      // City, Postal, MAC: Skip, not needed
    }

    // [Hardware Info] section
    if (currentSection === 'hardware') {
      // Username: Administrator\ZTLRFZYKCOID
      if (lowerLine.startsWith('username:') && !result.username) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.username = cleanValue(extractUsername(value));
        }
      }

      // Windows name: Windows Server 2016 Standard x64
      if (lowerLine.includes('windows name:') && !result.os) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.os = cleanValue(value);
        }
      }

      // Hardware ID: fce12345dbb464f8e31fb2bb1234f2c8
      if (lowerLine.includes('hardware id:') && !result.hwid) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.hwid = cleanValue(value);
        }
      }

      // Screen Resolution: 1920x1080
      // Skip, not needed

      // GPU: Microsoft Basic Display Adapter
      if (lowerLine.startsWith('gpu:') && !result.gpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.gpu = cleanValue(value);
        }
      }

      // CPU: QEMU Virtual CPU version 2.5+
      if (lowerLine.startsWith('cpu:') && !result.cpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.cpu = cleanValue(value);
        }
      }

      // RAM: 4 GB
      if (lowerLine.startsWith('ram:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }
    }

    // [Miscellaneous] section
    if (currentSection === 'miscellaneous') {
      // Antivirus products:
      if (lowerLine.includes('antivirus products:') && !result.antivirus) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.antivirus = cleanValue(value);
        }
      }

      // File Location: C:\Users\Administrator\Desktop\Ruvyjam.exe
      if (lowerLine.includes('file location:') && !result.filePath) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.filePath = cleanValue(value);
        }
      }
    }
  }

  return result;
}

