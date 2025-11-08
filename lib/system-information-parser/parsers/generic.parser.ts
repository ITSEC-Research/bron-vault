// Generic parser untuk System Information (fallback)

import { ParsedLogData } from '../types';
import { extractValue, combineOS, cleanValue, extractIP, extractUsername, extractCountryCode, normalizeLine, isSeparatorLine, extractSectionFromSeparator, isValidIP } from '../helpers';

/**
 * Generic parser - best-effort parsing untuk stealer yang tidak dikenal
 * Pattern-based matching untuk label umum
 */
export function parseGeneric(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Generic',
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
  let currentSection = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Skip separator lines
    if (isSeparatorLine(trimmedLine)) {
      // Extract section name dari separator jika ada (contoh: "----- Geolocation Data -----")
      const sectionName = extractSectionFromSeparator(trimmedLine);
      if (sectionName) {
        currentSection = sectionName.toLowerCase();
        // Normalize section name untuk matching
        // "Geolocation Data" -> "geolocation"
        // "Hardware Info" -> "hardware"
        if (currentSection.includes('geolocation')) {
          currentSection = 'geolocation';
        } else if (currentSection.includes('hardware')) {
          currentSection = 'hardware';
        } else if (currentSection.includes('network')) {
          currentSection = 'network';
        } else if (currentSection.includes('system')) {
          currentSection = 'system';
        } else if (currentSection.includes('machine')) {
          currentSection = 'machine';
        }
      }
      continue;
    }

    // Normalize: remove dash prefix dan indent/tab jika ada
    const normalizedLine = normalizeLine(trimmedLine);
    const lowerLine = normalizedLine.toLowerCase();

    // Detect sections (INI-like format)
    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
      currentSection = trimmedLine.slice(1, -1).toLowerCase();
      continue;
    }

    // OS - berbagai variasi label
    // Prioritaskan jika dalam section "hardware" atau "system"
    if (!result.os) {
      if (lowerLine.includes('os:') || lowerLine.includes('os name:') || lowerLine.includes('operation system:') || 
          lowerLine.includes('operating system:') || lowerLine.includes('system:') || lowerLine.includes('windows:') ||
          lowerLine.includes('pc type:') || lowerLine.includes('productname:') ||
          (lowerLine.includes('windows name:') && currentSection === 'hardware')) {
        const value = extractValue(normalizedLine);
        if (value && !value.toLowerCase().includes('unknown')) {
          if (lowerLine.includes('os name:') || lowerLine.includes('productname:') || lowerLine.includes('windows name:')) {
            osName = value;
          } else if (lowerLine.includes('os version:') || lowerLine.includes('productversion:')) {
            osVersion = value;
          } else {
            result.os = cleanValue(value);
          }
        }
      }
    }

    // OS Version (jika terpisah)
    if (lowerLine.includes('os version:') || lowerLine.includes('productversion:')) {
      const value = extractValue(normalizedLine);
      if (value && !value.toLowerCase().includes('unknown')) {
        osVersion = value;
      }
    }

    // IP Address - berbagai variasi
    // Prioritaskan jika dalam section "geolocation" atau "network"
    if (!result.ipAddress) {
      if (lowerLine.includes('ip:') || lowerLine.includes('ip address:') || lowerLine.includes('ip info:') ||
          lowerLine.includes('public ip address:') || lowerLine.includes('external ip:') ||
          lowerLine.includes('private ip address:') || lowerLine.includes('internal ip:') ||
          lowerLine.includes('ip geolocation:')) {
        const value = extractValue(normalizedLine);
        if (value) {
          // Extract IP dari format "127.0.0.1 [India]" atau "IP Geolocation : 127.0.0.1 [India]"
          let ipValue = value;
          const ipMatch = value.match(/^([\d.]+)/);
          if (ipMatch) {
            ipValue = ipMatch[1];
          }
          
          // Prioritaskan Public/External IP
          if (lowerLine.includes('public ip') || lowerLine.includes('external ip')) {
            result.ipAddress = cleanValue(extractIP(ipValue));
          } else if (!result.ipAddress) {
            result.ipAddress = cleanValue(extractIP(ipValue));
          }
        }
      }
    }

    // Username - berbagai variasi
    // Prioritaskan jika dalam section "hardware" atau "system"
    if (!result.username) {
      if (lowerLine.includes('user:') || lowerLine.includes('user name:') || lowerLine.includes('username:') ||
          lowerLine.includes('pc user:') || lowerLine.includes('registered owner:') ||
          (lowerLine.includes('windows name:') && currentSection === 'hardware')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.username = cleanValue(extractUsername(value));
        }
      }
    }

    // CPU - berbagai variasi
    // Prioritaskan jika dalam section "hardware"
    if (!result.cpu) {
      if (lowerLine.includes('cpu:') || lowerLine.includes('cpu (processor):') || lowerLine.includes('cpu info:') ||
          lowerLine.includes('cpu name:') || lowerLine.includes('processor:') || lowerLine.includes('processor(s):')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
          result.cpu = cleanValue(value);
        }
      }
    }

    // RAM - berbagai variasi
    // Prioritaskan jika dalam section "hardware"
    if (!result.ram) {
      if (lowerLine.includes('ram:') || lowerLine.includes('ram (memory):') || lowerLine.includes('ram size:') ||
          lowerLine.includes('amount of ram:') || lowerLine.includes('installed ram:') ||
          lowerLine.includes('total physical memory:') || lowerLine.includes('memory:')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
          result.ram = cleanValue(value);
        }
      }
    }

    // Computer Name - berbagai variasi
    if (!result.computerName) {
      if (lowerLine.includes('computer:') || lowerLine.includes('computer name:') || lowerLine.includes('compname:') ||
          lowerLine.includes('host name:') || lowerLine.includes('hostname:') || lowerLine.includes('machine name:') ||
          lowerLine.includes('netbios:') || lowerLine.includes('pc:') || lowerLine.includes('pc name:')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.computerName = cleanValue(value);
        }
      }
    }

    // GPU - berbagai variasi
    // Prioritaskan jika dalam section "hardware"
    if (!result.gpu) {
      if (lowerLine.includes('gpu:') || lowerLine.includes('gpu (display devices):') || lowerLine.includes('gpu info:') ||
          lowerLine.includes('gpu name:') || lowerLine.includes('display devices:') || lowerLine.includes('video card:') ||
          lowerLine.includes('videocard:') || lowerLine.includes('chipset model:')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
          result.gpu = cleanValue(value);
        }
      }
    }

    // Country - berbagai variasi
    // Prioritaskan jika dalam section "geolocation"
    if (!result.country) {
      if (lowerLine.includes('country:') || lowerLine.includes('country code:') || 
          (lowerLine.includes('location:') && currentSection === 'geolocation')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          // Extract country code dari format "Russia (RU)" atau "127.0.0.1 [India]"
          let countryValue = value;
          const countryMatch = value.match(/\(([A-Z]{2})\)|\[([A-Z]{2,})\]/);
          if (countryMatch) {
            countryValue = countryMatch[1] || countryMatch[2];
          } else {
            // Jika value adalah IP address, skip (bug di log)
            if (isValidIP(value)) {
              continue;
            }
          }
          result.country = cleanValue(extractCountryCode(countryValue));
        }
      }
    }

    // Log Date - berbagai variasi
    if (!result.logDate) {
      if (lowerLine.includes('date:') || lowerLine.includes('local date:') || lowerLine.includes('current time:') ||
          lowerLine.includes('log date:') || lowerLine.includes('save time:') || lowerLine.includes('time:')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.logDate = cleanValue(value);
        }
      }
    }

    // HWID - berbagai variasi
    // Prioritaskan jika dalam section "hardware"
    if (!result.hwid) {
      if (lowerLine.includes('hwid:') || lowerLine.includes('hardware id:') || lowerLine.includes('hardware uuid:') ||
          lowerLine.includes('machineid:') || lowerLine.includes('bot_id:') || lowerLine.includes('user id:') ||
          lowerLine.includes('serial number:') || lowerLine.includes('machineid:')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim() && !value.toLowerCase().includes('unknown') && !value.toLowerCase().includes('[redacted]')) {
          result.hwid = cleanValue(value);
        }
      }
    }

    // File Path - berbagai variasi
    if (!result.filePath) {
      if (lowerLine.includes('file location:') || lowerLine.includes('path:') || lowerLine.includes('execute path:') ||
          lowerLine.includes('running path:') || lowerLine.includes('current jarfile path:') ||
          lowerLine.includes('process executable path:') || lowerLine.includes('startup folder:') ||
          lowerLine.includes('launch:') || lowerLine.includes('work dir:') || lowerLine.includes('file path:')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim()) {
          result.filePath = cleanValue(value);
        }
      }
    }

    // Antivirus - berbagai variasi
    if (!result.antivirus) {
      if (lowerLine.includes('av:') || lowerLine.includes('anti virus:') || lowerLine.includes('anti-viruses:') ||
          lowerLine.includes('antivirus:') || lowerLine.includes('antivirus products:')) {
        const value = extractValue(normalizedLine);
        if (value && value.trim() && !value.toLowerCase().includes('unknown')) {
          result.antivirus = cleanValue(value);
        }
      }
    }
  }

  // Combine OS Name dan OS Version jika terpisah
  if (!result.os && (osName || osVersion)) {
    result.os = cleanValue(combineOS(osName, osVersion));
  }

  return result;
}

