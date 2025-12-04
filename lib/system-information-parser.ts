// Main System Information Parser Service

import { detectStealerType } from './system-information-parser/signature-detector';
import { parseGeneric } from './system-information-parser/parsers/generic.parser';
import { parseLumma } from './system-information-parser/parsers/lumma.parser';
import { parseExelaStealer } from './system-information-parser/parsers/exelastealer.parser';
import { parseAstris } from './system-information-parser/parsers/astris.parser';
import { parseBlankGrabber } from './system-information-parser/parsers/blank-grabber.parser';
import { parseAtomicMac } from './system-information-parser/parsers/atomic-mac.parser';
// Phase 3: Priority 2
import { parseCryptBot } from './system-information-parser/parsers/cryptbot.parser';
import { parseDarkCrystalRAT } from './system-information-parser/parsers/darkcrystal-rat.parser';
import { parseMeduza } from './system-information-parser/parsers/meduza.parser';
import { parseNoxty } from './system-information-parser/parsers/noxty.parser';
import { parsePhemedrone } from './system-information-parser/parsers/phemedrone.parser';
// Phase 4: Priority 3
import { parsePredatorTheThief } from './system-information-parser/parsers/predator-the-thief.parser';
import { parseRaccoon } from './system-information-parser/parsers/raccoon.parser';
import { parseRedLineMETA } from './system-information-parser/parsers/redline-meta.parser';
import { parseRhadamanthys } from './system-information-parser/parsers/rhadamanthys.parser';
import { parseRisePro } from './system-information-parser/parsers/risepro.parser';
// Phase 5: Priority 4
import { parseRLStealer } from './system-information-parser/parsers/rl-stealer.parser';
import { parseStealC } from './system-information-parser/parsers/stealc.parser';
import { parseStealerium } from './system-information-parser/parsers/stealerium.parser';
import { parseSkalka } from './system-information-parser/parsers/skalka.parser';
import { parseVidar } from './system-information-parser/parsers/vidar.parser';
// Phase 6: Priority 5
import { parseXFiles } from './system-information-parser/parsers/xfiles.parser';
import { parseAilurophile } from './system-information-parser/parsers/ailurophile.parser';
import { parseArechClientV2 } from './system-information-parser/parsers/arech-client-v2.parser';
import { parseBanshee } from './system-information-parser/parsers/banshee.parser';
import { saveSystemInformation } from './system-information-parser/database';
import { ParsedLogData, SystemInfoFile, ParserFunction } from './system-information-parser/types';
import { normalizeEncoding, cleanValue } from './system-information-parser/helpers';
import { normalizeDateTime } from './system-information-parser/date-normalizer';

// Parser map
const PARSER_MAP: Record<string, ParserFunction> = {
  'Generic': parseGeneric,
  'Lumma': parseLumma,
  'ExelaStealer': parseExelaStealer,
  'Astris': parseAstris,
  'Blank Grabber': parseBlankGrabber,
  'Atomic Mac': parseAtomicMac,
  // Phase 3: Priority 2
  'CryptBot': parseCryptBot,
  'DarkCrystal RAT': parseDarkCrystalRAT,
  'Meduza': parseMeduza,
  'Noxty': parseNoxty,
  'Phemedrone': parsePhemedrone,
  // Phase 4: Priority 3
  'PredatorTheThief': parsePredatorTheThief,
  'Raccoon': parseRaccoon,
  'RedLine/META': parseRedLineMETA,
  'Rhadamanthys': parseRhadamanthys,
  'RisePro': parseRisePro,
  // Phase 5: Priority 4
  'RL Stealer': parseRLStealer,
  'StealC': parseStealC,
  'Stealerium': parseStealerium,
  'Skalka': parseSkalka,
  'Vidar': parseVidar,
  // Phase 6: Priority 5
  'XFiles': parseXFiles,
  'Ailurophile': parseAilurophile,
  'ArechClientV2': parseArechClientV2,
  'Banshee': parseBanshee,
};

/**
 * Process system information files with error handling and logging
 */
export async function processSystemInformationFiles(
  deviceId: string,
  files: SystemInfoFile[]
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ fileName: string; error: string }>;
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ fileName: string; error: string }>,
  };
  
  // Filter relevant files (system information files)
  const systemInfoFiles = files.filter(file => {
    const lowerFileName = file.fileName.toLowerCase();
    const systemInfoPatterns = [
      'system', 'information', 'userinfo', 'user_info', 
      'systeminfo', 'system_info', 'info'
    ];
    return systemInfoPatterns.some(pattern => lowerFileName.includes(pattern));
  });
  
  console.log(`🔍 Processing ${systemInfoFiles.length} system information files for device ${deviceId}`);
  
  for (const file of systemInfoFiles) {
    try {
      // Normalize encoding
      const normalizedContent = normalizeEncoding(file.content);
      
      // Layer 1: Detect stealer type
      const stealerType = detectStealerType(normalizedContent, file.fileName);
      console.log(`📋 Detected stealer type: ${stealerType} for file ${file.fileName}`);
      
      // Layer 2: Get parser (specific or generic)
      const parser = PARSER_MAP[stealerType] || parseGeneric;
      
      // Parse
      let parsedData: ParsedLogData;
      try {
        parsedData = parser(normalizedContent, file.fileName);
        parsedData.stealerType = stealerType;
        
        // Clean values (remove "Unknown", "[redacted]", dll)
        const cleanedLogDate = cleanValue(parsedData.logDate);
        
        // ENHANCEMENT: Normalize date & time format (after parsing, before save)
        // IMPORTANT: Parser still returns raw string (AS IS), normalization only converts format
        const normalizedDateTime = normalizeDateTime(cleanedLogDate);
        
        parsedData = {
          ...parsedData,
          os: cleanValue(parsedData.os),
          ipAddress: cleanValue(parsedData.ipAddress),
          username: cleanValue(parsedData.username),
          cpu: cleanValue(parsedData.cpu),
          ram: cleanValue(parsedData.ram),
          computerName: cleanValue(parsedData.computerName),
          gpu: cleanValue(parsedData.gpu),
          country: cleanValue(parsedData.country),
          logDate: normalizedDateTime.date,      // ← NORMALIZED DATE (YYYY-MM-DD)
          logTime: normalizedDateTime.time,       // ← NORMALIZED TIME (HH:mm:ss)
          hwid: cleanValue(parsedData.hwid),
          filePath: cleanValue(parsedData.filePath),
          antivirus: cleanValue(parsedData.antivirus),
        };
      } catch (parseError) {
        console.error(`❌ Parse error for file ${file.fileName}:`, parseError);
        throw new Error(`Parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      // Save to database
      await saveSystemInformation(deviceId, parsedData, file.fileName);
      results.success++;
      
      console.log(`✅ Successfully parsed and saved ${file.fileName} for device ${deviceId}`);
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.errors.push({
        fileName: file.fileName,
        error: errorMessage,
      });
      
      console.error(`❌ Error processing file ${file.fileName} for device ${deviceId}:`, error);
      // Continue with other files
    }
  }
  
  console.log(`📊 Processing complete: ${results.success} success, ${results.failed} failed`);
  return results;
}

