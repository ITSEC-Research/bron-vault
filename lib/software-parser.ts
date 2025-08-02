import { pool } from "./mysql";

interface SoftwareData {
  software_name: string;
  version: string | null;
}

export async function parseSoftwareFile(
  deviceId: string,
  fileContent: string,
  sourceFile: string
): Promise<void> {
  try {
    console.log(`🔍 Parsing file: ${sourceFile} for device: ${deviceId}`);
    console.log(`📄 File content preview (first 500 chars):`, fileContent.substring(0, 500));
    
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    console.log(`📊 Total lines in file: ${lines.length}`);
    console.log(`📋 First 5 lines:`, lines.slice(0, 5));
    
    const softwareList: SoftwareData[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      // Additional filters as requested:
      // 1. Skip if there are 3 consecutive spaces
      if (trimmedLine.includes('   ')) continue;
      // 2. Skip if contains URL
      if (/https?:\/\//i.test(trimmedLine) || /www\./i.test(trimmedLine) || /\.(com|me|org|net|io|gov|edu)\b/i.test(trimmedLine)) continue;
      // 3. Skip if there are 3 consecutive special characters
      if (/(___|===|\*\*\*|&&&|###|\$\$\$)/.test(trimmedLine)) continue;
      // 4. Skip if length > 120
      if (trimmedLine.length > 120) continue;
      // 5. Skip if same digit repeated 4 times consecutively (e.g.: 0000, 1111, etc)
      if (/(\d)\1{3,}/.test(trimmedLine)) continue;

      // Parse software name and version
      const { software_name, version } = parseSoftwareLine(trimmedLine);
      
      if (software_name) {
        softwareList.push({ software_name, version });
        console.log(`🔍 Parsed: "${software_name}" (version: ${version || 'null'})`);
      }
    }

    // Insert software data to database
    if (softwareList.length > 0) {
      // Process in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < softwareList.length; i += batchSize) {
        const batch = softwareList.slice(i, i + batchSize);
        const values = batch.map(software => [
          deviceId,
          software.software_name,
          software.version,
          sourceFile
        ]);

        try {
          const query = `
            INSERT INTO software (device_id, software_name, version, source_file)
            VALUES ?
            ON DUPLICATE KEY UPDATE
            software_name = VALUES(software_name),
            version = VALUES(version),
            source_file = VALUES(source_file)
          `;

          await pool.query(query, [values]);
          console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} entries) from ${sourceFile} for device ${deviceId}`);
        } catch (insertError) {
          console.error(`❌ Error inserting software batch:`, insertError);
          // Continue with next batch even if this one fails
        }
      }
      
      console.log(`✅ Completed parsing ${softwareList.length} software entries from ${sourceFile} for device ${deviceId}`);
    } else {
      console.log(`⚠️ No software entries found in ${sourceFile} for device ${deviceId}`);
    }

  } catch (error) {
    console.error(`❌ Error parsing software file ${sourceFile} for device ${deviceId}:`, error);
    throw error;
  }
}

function parseSoftwareLine(line: string): { software_name: string; version: string | null } {
  // Remove common prefixes/suffixes that might interfere
  let cleanLine = line
    .replace(/^[-_\s]+/, '') // Remove leading dashes, underscores, spaces
    .replace(/[-_\s]+$/, '') // Remove trailing dashes, underscores, spaces
    .trim();

  if (!cleanLine) {
    return { software_name: '', version: null };
  }

  // Remove numbering patterns like "1) ", "2) ", etc.
  cleanLine = cleanLine.replace(/^\d+\)\s*/, '');

  // Pattern 1: Software with version in format "Software Name - Version"
  const dashPattern = /^(.+?)\s*-\s*(.+)$/;
  const dashMatch = cleanLine.match(dashPattern);
  
  if (dashMatch) {
    const software_name = dashMatch[1].trim();
    const versionPart = dashMatch[2].trim();
    
    // Extract only the version number, not the full path/description
    const extractedVersion = extractVersionFromString(versionPart);
    if (extractedVersion) {
      return { software_name, version: extractedVersion };
    }
  }

  // Pattern 2: Software with version in parentheses "Software Name (Version)"
  const parenthesesPattern = /^(.+?)\s*\(([^)]+)\)$/;
  const parenthesesMatch = cleanLine.match(parenthesesPattern);
  
  if (parenthesesMatch) {
    const software_name = parenthesesMatch[1].trim();
    const versionPart = parenthesesMatch[2].trim();
    
    const extractedVersion = extractVersionFromString(versionPart);
    if (extractedVersion) {
      return { software_name, version: extractedVersion };
    }
  }

  // Pattern 3: Software with version at the end "Software Name v1.2.3"
  const versionPattern = /^(.+?)\s+(v?\d+\.\d+(?:\.\d+)?(?:[-\w]+)?)$/i;
  const versionMatch = cleanLine.match(versionPattern);
  
  if (versionMatch) {
    const software_name = versionMatch[1].trim();
    const version = versionMatch[2].trim();
    return { software_name, version };
  }

  // Pattern 4: Software with version in format "Software Name Version X.X.X"
  const wordVersionPattern = /^(.+?)\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?(?:[-\w]+)?)$/i;
  const wordVersionMatch = cleanLine.match(wordVersionPattern);
  
  if (wordVersionMatch) {
    const software_name = wordVersionMatch[1].trim();
    const version = wordVersionMatch[2].trim();
    return { software_name, version };
  }

  // Pattern 5: Software with version in brackets "Software Name [Version]"
  const bracketPattern = /^(.+?)\s*\[([^\]]+)\]$/;
  const bracketMatch = cleanLine.match(bracketPattern);
  
  if (bracketMatch) {
    const software_name = bracketMatch[1].trim();
    const versionPart = bracketMatch[2].trim();
    
    const extractedVersion = extractVersionFromString(versionPart);
    if (extractedVersion) {
      return { software_name, version: extractedVersion };
    }
  }

  // If no version pattern found, treat entire line as software name
  return { software_name: cleanLine, version: null };
}

function extractVersionFromString(str: string): string | null {
  // Look for version patterns in the string
  const versionPatterns = [
    /\d+\.\d+\.\d+\.\d+/, // Version like "1.0.0.0"
    /\d+\.\d+\.\d+/, // Version like "1.0.0"
    /\d+\.\d+/, // Version like "1.0"
    /v\d+\.\d+\.\d+/, // Version like "v1.0.0"
    /v\d+\.\d+/, // Version like "v1.0"
    /\d{4}/, // Year like "2021"
  ];

  for (const pattern of versionPatterns) {
    const match = str.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // If no version pattern found, return null
  return null;
}

function isVersionString(str: string): boolean {
  // Check if string contains version-like patterns
  const versionPatterns = [
    /\d+\.\d+/, // Basic version like "1.0"
    /\d+\.\d+\.\d+/, // Version like "1.0.0"
    /\d+\.\d+\.\d+\.\d+/, // Version like "1.0.0.0"
    /v\d+\.\d+/, // Version like "v1.0"
    /version\s+\d+/i, // Version like "Version 1"
    /\d{4}/, // Year like "2021"
    /x\d{2}/i, // Architecture like "x64", "x86"
  ];

  return versionPatterns.some(pattern => pattern.test(str));
}

export async function processSoftwareFiles(
  deviceId: string,
  files: { [key: string]: string }
): Promise<void> {
  console.log(`🔍 Starting software processing for device: ${deviceId}`);
  console.log(`📁 Available files:`, Object.keys(files));
  
  const softwareFiles = [
    'software.txt',
    'InstalledSoftware.txt', 
    'InstalledPrograms.txt',
    'ProgramsList.txt',
    'Software.txt' // Add uppercase version
  ];

  for (const fileName of softwareFiles) {
    const fileContent = files[fileName];
    if (fileContent) {
      console.log(`📖 Processing software file: ${fileName} (${fileContent.length} bytes)`);
      try {
        await parseSoftwareFile(deviceId, fileContent, fileName);
      } catch (error) {
        console.error(`❌ Failed to parse software file ${fileName}:`, error);
        // Continue with other files even if one fails
      }
    } else {
      console.log(`⚠️ File ${fileName} not found in available files`);
    }
  }
  
  console.log(`✅ Completed software processing for device: ${deviceId}`);
} 