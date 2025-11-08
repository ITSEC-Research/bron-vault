// Lumma stealer parser

import { ParsedLogData } from '../types';
import { extractValue, cleanValue, extractIP, extractUsername, extractCountryCode, isValidIP, normalizeLine, isSeparatorLine } from '../helpers';

/**
 * Parse Lumma stealer log
 * Format: OS Version: Windows 11 Pro (10.0.22631) x64
 * Handle format dengan indent/tab untuk list items (Anti Virus, GPU)
 */
export function parseLumma(content: string, fileName: string): ParsedLogData {
  const lines = content.split(/\r?\n/);
  const result: ParsedLogData = {
    stealerType: 'Lumma',
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

  let isInAntiVirusSection = false;
  let isInGPUSection = false;
  const antivirusList: string[] = [];
  const gpuList: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      isInAntiVirusSection = false;
      isInGPUSection = false;
      continue;
    }

    // Skip separator lines
    if (isSeparatorLine(trimmedLine)) {
      continue;
    }

    // Normalize: remove dash prefix dan indent/tab jika ada
    // Ini penting karena Lumma log sering pakai dash prefix dan indent di awal line
    const normalizedLine = normalizeLine(trimmedLine);
    const lowerLine = normalizedLine.toLowerCase();

    // OS Version: Windows 11 Pro (10.0.22631) x64
    if (lowerLine.startsWith('os version:') && !result.os) {
      const value = extractValue(normalizedLine);
      result.os = cleanValue(value);
    }

    // IP Address: 31.215.26.35
    if (lowerLine.startsWith('ip address:') && !result.ipAddress) {
      const value = extractValue(normalizedLine);
      result.ipAddress = cleanValue(extractIP(value));
    }

    // User: prodi
    if ((lowerLine.startsWith('user:') || lowerLine.startsWith('username:')) && !result.username) {
      const value = extractValue(normalizedLine);
      result.username = cleanValue(extractUsername(value));
    }

    // CPU Name: Intel(R) Core(TM) i5-3470 CPU @ 3.20GHz
    if (lowerLine.startsWith('cpu name:') && !result.cpu) {
      const value = extractValue(normalizedLine);
      result.cpu = cleanValue(value);
    }

    // RAM Size: 4096MB
    if (lowerLine.startsWith('ram size:') && !result.ram) {
      const value = extractValue(normalizedLine);
      result.ram = cleanValue(value);
    }

    // Computer: DESKTOP-IBUBMU7
    if ((lowerLine.startsWith('computer:') || lowerLine.startsWith('hostname:') || lowerLine.startsWith('pc:')) && !result.computerName) {
      const value = extractValue(normalizedLine);
      result.computerName = cleanValue(value);
    }

    // GPU: (bisa dalam format list dengan indent)
    if (lowerLine.startsWith('gpu:') && !result.gpu) {
      isInGPUSection = true;
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Jika ada value langsung di line GPU:
        result.gpu = cleanValue(value);
        isInGPUSection = false;
      }
      // Jika tidak ada value, akan diambil dari baris berikutnya (indented)
      continue;
    }

    // Handle GPU list items (indented dengan tab atau dash)
    // Format: "\t- Intel(R) UHD Graphics 600" atau "  - AMD Radeon(TM) R7 Graphics"
    if (isInGPUSection) {
      // Cek jika line adalah indented (tab atau multiple spaces) DAN dimulai dengan dash
      const isIndented = line.startsWith('\t') || /^[\s]{2,}/.test(line);
      const hasDashPrefix = trimmedLine.startsWith('-');
      
      if (isIndented && hasDashPrefix) {
        // Ini adalah GPU item
        const gpuValue = trimmedLine.replace(/^-\s*/, '').trim();
        if (gpuValue && !gpuValue.toLowerCase().includes('gpu:') && gpuValue.length > 0) {
          gpuList.push(gpuValue);
        }
        continue;
      } else if (isIndented && !hasDashPrefix) {
        // Indented tapi tidak ada dash, mungkin masih GPU item (format alternatif)
        const gpuValue = trimmedLine;
        if (gpuValue && gpuValue.length > 0 && !gpuValue.toLowerCase().includes('gpu:')) {
          gpuList.push(gpuValue);
        }
        continue;
      } else {
        // Tidak indented lagi, keluar dari GPU section
        isInGPUSection = false;
        if (gpuList.length > 0 && !result.gpu) {
          result.gpu = cleanValue(gpuList[0]); // Ambil GPU pertama
        }
      }
    }

    // Anti Virus: (bisa dalam format list dengan indent)
    if ((lowerLine.startsWith('anti virus:') || lowerLine.startsWith('antivirus:')) && !result.antivirus) {
      isInAntiVirusSection = true;
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        // Jika ada value langsung di line Anti Virus:
        result.antivirus = cleanValue(value);
        isInAntiVirusSection = false;
      }
      // Jika tidak ada value, akan diambil dari baris berikutnya (indented)
      continue;
    }

    // Handle Anti Virus list items (indented dengan tab atau dash)
    // Format: "\t- Windows Defender"
    if (isInAntiVirusSection) {
      // Cek jika line adalah indented (tab atau multiple spaces) DAN dimulai dengan dash
      const isIndented = line.startsWith('\t') || /^[\s]{2,}/.test(line);
      const hasDashPrefix = trimmedLine.startsWith('-');
      
      if (isIndented && hasDashPrefix) {
        // Ini adalah Anti Virus item
        const avValue = trimmedLine.replace(/^-\s*/, '').trim();
        if (avValue && !avValue.toLowerCase().includes('anti virus:') && !avValue.toLowerCase().includes('antivirus:') && avValue.length > 0) {
          antivirusList.push(avValue);
        }
        continue;
      } else if (isIndented && !hasDashPrefix) {
        // Indented tapi tidak ada dash, mungkin masih AV item (format alternatif)
        const avValue = trimmedLine;
        if (avValue && avValue.length > 0 && !avValue.toLowerCase().includes('anti virus:') && !avValue.toLowerCase().includes('antivirus:')) {
          antivirusList.push(avValue);
        }
        continue;
      } else {
        // Tidak indented lagi, keluar dari Anti Virus section
        isInAntiVirusSection = false;
        if (antivirusList.length > 0 && !result.antivirus) {
          result.antivirus = cleanValue(antivirusList.join(', ')); // Gabungkan semua AV
        }
      }
    }

    // Country: 31.215.26.35 (handle jika country berisi IP address - ini bug di log, tapi kita handle)
    if (lowerLine.startsWith('country:') && !result.country) {
      const value = extractValue(normalizedLine);
      // Jika value adalah IP address, skip (ini bug di log)
      if (isValidIP(value)) {
        // Skip, ini sepertinya IP address yang salah ditempatkan di field Country
        continue;
      }
      result.country = cleanValue(extractCountryCode(value));
    }

    // Local Date: 28.06.2025 12:28:40
    if (lowerLine.startsWith('local date:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      result.logDate = cleanValue(value);
    }

    // Time: 28.06.2025 11:28:43 (alternatif format)
    if (lowerLine.startsWith('time:') && !result.logDate) {
      const value = extractValue(normalizedLine);
      // Extract time dari format "28.06.2025 11:28:43 (sig:...)"
      const timeMatch = value.match(/^([\d\.\s:]+)/);
      if (timeMatch) {
        result.logDate = cleanValue(timeMatch[1].trim());
      } else {
        result.logDate = cleanValue(value);
      }
    }

    // HWID: 8E21F8D6BF93A67BDB5A5F4347C650A5
    // Format: "- HWID: 9408D6EA977FFD176A27394847C650A5"
    if (lowerLine.startsWith('hwid:') && !result.hwid) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.hwid = cleanValue(value);
      }
    }

    // Path: C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe
    if (lowerLine.startsWith('path:') && !result.filePath) {
      const value = extractValue(normalizedLine);
      if (value && value.trim()) {
        result.filePath = cleanValue(value);
      }
    }
  }

  // Finalize GPU dan Anti Virus jika masih dalam section (setelah loop selesai)
  // Ini penting untuk handle case dimana GPU/Anti Virus section tidak ditutup dengan field lain
  if (isInGPUSection && gpuList.length > 0 && !result.gpu) {
    result.gpu = cleanValue(gpuList[0]);
  }
  if (isInAntiVirusSection && antivirusList.length > 0 && !result.antivirus) {
    result.antivirus = cleanValue(antivirusList.join(', '));
  }

  return result;
}

