// Database operations untuk System Information Parser

import { executeQuery } from '@/lib/mysql';
import { ParsedLogData } from './types';
import { isValidIP } from './helpers';

/**
 * Merge strategy untuk multiple files per device
 * Gabungkan data yang lebih lengkap (prioritaskan non-null values)
 */
function mergeSystemInformation(
  existing: ParsedLogData | null,
  newData: ParsedLogData
): ParsedLogData {
  if (!existing) return newData;
  
  // Merge strategy: ambil nilai yang lebih lengkap
  // Jika existing null tapi newData ada, gunakan newData
  // Jika keduanya ada, prioritaskan newData (file terakhir)
  return {
    stealerType: newData.stealerType || existing.stealerType,
    os: newData.os || existing.os,
    ipAddress: newData.ipAddress || existing.ipAddress,
    username: newData.username || existing.username,
    cpu: newData.cpu || existing.cpu,
    ram: newData.ram || existing.ram,
    computerName: newData.computerName || existing.computerName,
    gpu: newData.gpu || existing.gpu,
    country: newData.country || existing.country,
    logDate: newData.logDate || existing.logDate,
    hwid: newData.hwid || existing.hwid,
    filePath: newData.filePath || existing.filePath,
    antivirus: newData.antivirus || existing.antivirus,
  };
}

/**
 * Validasi data sebelum save
 */
function validateSystemInformation(data: ParsedLogData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validasi IP address jika ada
  if (data.ipAddress && !isValidIP(data.ipAddress)) {
    errors.push(`Invalid IP address: ${data.ipAddress}`);
  }
  
  // Validasi OS minimal length
  if (data.os && data.os.length < 3) {
    errors.push(`OS value too short: ${data.os}`);
  }
  
  // Validasi username minimal length
  if (data.username && data.username.length < 1) {
    errors.push(`Username value too short: ${data.username}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Ambil existing data dari database
 */
async function getExistingSystemInformation(
  deviceId: string
): Promise<ParsedLogData | null> {
  try {
    const result = await executeQuery(
      `SELECT * FROM systeminformation WHERE device_id = ?`,
      [deviceId]
    ) as any[];
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      stealerType: row.stealer_type || null,
      os: row.os || null,
      ipAddress: row.ip_address || null,
      username: row.username || null,
      cpu: row.cpu || null,
      ram: row.ram || null,
      computerName: row.computer_name || null,
      gpu: row.gpu || null,
      country: row.country || null,
      logDate: row.log_date || null,
      hwid: row.hwid || null,
      filePath: row.file_path || null,
      antivirus: row.antivirus || null,
    };
  } catch (error) {
    console.error(`Error getting existing system information:`, error);
    return null;
  }
}

/**
 * Save system information dengan merge strategy dan validasi
 */
export async function saveSystemInformation(
  deviceId: string,
  data: ParsedLogData,
  sourceFile: string
): Promise<void> {
  try {
    // Validasi data
    const validation = validateSystemInformation(data);
    if (!validation.isValid) {
      console.warn(`Validation errors for device ${deviceId}:`, validation.errors);
      // Continue anyway, tapi log warning
    }
    
    // Ambil existing data jika ada
    const existing = await getExistingSystemInformation(deviceId);
    
    // Merge dengan existing data
    const mergedData = mergeSystemInformation(existing, data);
    
    // Save ke database
    const query = `
      INSERT INTO systeminformation (
        device_id, stealer_type, os, ip_address, username, cpu, ram,
        computer_name, gpu, country, log_date, hwid, file_path, antivirus, source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        stealer_type = VALUES(stealer_type),
        os = VALUES(os),
        ip_address = VALUES(ip_address),
        username = VALUES(username),
        cpu = VALUES(cpu),
        ram = VALUES(ram),
        computer_name = VALUES(computer_name),
        gpu = VALUES(gpu),
        country = VALUES(country),
        log_date = VALUES(log_date),
        hwid = VALUES(hwid),
        file_path = VALUES(file_path),
        antivirus = VALUES(antivirus),
        source_file = VALUES(source_file),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await executeQuery(query, [
      deviceId,
      mergedData.stealerType,
      mergedData.os,
      mergedData.ipAddress,
      mergedData.username,
      mergedData.cpu,
      mergedData.ram,
      mergedData.computerName,
      mergedData.gpu,
      mergedData.country,
      mergedData.logDate,
      mergedData.hwid,
      mergedData.filePath,
      mergedData.antivirus,
      sourceFile,
    ]);
    
    console.log(`✅ Saved system information for device ${deviceId} from ${sourceFile}`);
  } catch (error) {
    console.error(`❌ Error saving system information for device ${deviceId}:`, error);
    throw error;
  }
}

