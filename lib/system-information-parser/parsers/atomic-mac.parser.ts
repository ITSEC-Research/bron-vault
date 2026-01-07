// Atomic Mac parser (macOS system_profiler format)

import { ParsedLogData } from '../types';
import { extractValue, combineOS, cleanValue, extractIP, extractCountryCode, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Atomic Mac stealer log (macOS format)
 * Format: ProductName: macOS
 *         ProductVersion: 14.6
 */
export function parseAtomicMac(content: string, _fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Atomic Mac',
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

  let productName: string | null = null;
  let productVersion: string | null = null;
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

    // Detect sections (Hardware Overview, Graphics/Displays, etc.)
    if (trimmedLine.includes(':')) {
      const colonIndex = trimmedLine.indexOf(':');
      const beforeColon = trimmedLine.substring(0, colonIndex).trim();
      if (beforeColon && !beforeColon.includes(' ')) {
        currentSection = beforeColon.toLowerCase();
      }
    }

    // ProductName: macOS
    if (lowerLine.startsWith('productname:') && !productName) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        productName = value;
      }
    }

    // ProductVersion: 14.6
    if (lowerLine.startsWith('productversion:') && !productVersion) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        productVersion = value;
      }
    }

    // BuildVersion: 23G5075b
    if (lowerLine.startsWith('buildversion:') && productVersion) {
      const buildVersion = extractValue(normalizedLine);
      if (buildVersion && buildVersion.trim()) {
        productVersion = `${productVersion} (${buildVersion})`;
      }
    }

    // IP: 47.160.126.208/284629518
    if (lowerLine.startsWith('ip:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.ipAddress = cleanValue(extractIP(value));
      }
    }

    // Country: US
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.country = cleanValue(extractCountryCode(value));
      }
    }

    // Hardware Overview section
    if (currentSection === 'hardware overview' || lowerLine.includes('hardware overview')) {
      // Model Name: MacBook Pro
      if (lowerLine.includes('model name:') && !result.computerName) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.computerName = cleanValue(value);
        }
      }

      // Chip: Apple M3 Pro
      if (lowerLine.includes('chip:') && !result.cpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.cpu = cleanValue(value);
        }
      }

      // Memory: 18 GB
      if (lowerLine.includes('memory:') && !result.ram) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.ram = cleanValue(value);
        }
      }

      // Serial Number (system): F5X2YRHCVQ
      if (lowerLine.includes('serial number') && !result.hwid) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.hwid = cleanValue(value);
        }
      }
    }

    // Graphics/Displays section
    if (currentSection === 'graphics/displays' || lowerLine.includes('graphics/displays')) {
      // Chipset Model: Apple M3 Pro
      if (lowerLine.includes('chipset model:') && !result.gpu) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.gpu = cleanValue(value);
        }
      }
    }
  }

  // Combine ProductName dan ProductVersion
  if (productName || productVersion) {
    result.os = cleanValue(combineOS(productName, productVersion));
  }

  return result;
}

