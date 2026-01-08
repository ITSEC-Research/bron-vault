// Helper functions for System Information Parser

import { normalizeCountryToCode } from './country-mapping';

/**
 * Normalize line by removing dash prefix and indent/tab
 * Handle various prefix formats commonly found in stealer logs:
 * - "- OS Version: ..." (dash prefix)
 * - "  OS Version: ..." (space indent)
 * - "\tOS Version: ..." (tab indent)
 * - "  - OS Version: ..." (space + dash)
 * - "\t- OS Version: ..." (tab + dash)
 */
export function normalizeLine(line: string): string {
  if (!line) return line;
  
  let normalized = line.trim();
  
  // Remove dash prefix if exists (format: "- OS Version: ..." or "  - OS Version: ...")
  normalized = normalized.replace(/^-\s*/, '');
  
  // Remove leading spaces and tabs (indent)
  normalized = normalized.replace(/^[\s\t]+/, '');
  
  return normalized.trim();
}

/**
 * Detect if line is a separator line
 * Handle various separator formats:
 * - "-------------" (dash separator)
 * - "==================================================" (equals separator)
 * - "----- Geolocation Data -----" (dash with text)
 * - "----- Hardware Info -----" (dash with text)
 */
export function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  
  // 1. Blank line is a separator
  if (!trimmed) return true;
  
  // 2. Pure separator with repeated characters (= or -)
  // Pattern: minimum 8 characters = or - repeated, MUST BE PURE
  // Example: "========" or "--------" or "-------------"
  const pureSeparatorPattern = /^[=]{8,}$|^[-]{8,}$/;
  if (pureSeparatorPattern.test(trimmed)) {
    return true;
  }
  
  // 3. Separator with text in the middle (dash with text)
  // Pattern: "----- Text -----" or "----- Geolocation Data -----"
  // - Starts with 3+ dashes
  // - Followed by text (may have spaces)
  // - Ends with 3+ dashes
  const dashWithTextPattern = /^[-]{3,}\s+.+\s+[-]{3,}$/i;
  if (dashWithTextPattern.test(trimmed)) {
    return true;
  }
  
  // 4. Separator with text in the middle (equals with text)
  // Pattern: "==== Text ===="
  const equalsWithTextPattern = /^[=]{3,}\s+.+\s+[=]{3,}$/i;
  if (equalsWithTextPattern.test(trimmed)) {
    return true;
  }
  
  // 5. Branded separator (e.g., ====Daisy====)
  // Pattern: Starts with 8+ characters (= or -), text in middle, ends with 8+ characters
  const brandedSeparatorPattern = /^[=]{8,}.+[=]{8,}$|^[-]{8,}.+[-]{8,}$/;
  if (brandedSeparatorPattern.test(trimmed)) {
    // Ensure line does NOT contain system info field pattern
    // If it contains field pattern, then it's NOT a separator
    const lowerLine = trimmed.toLowerCase();
    const hasFieldPattern = 
      lowerLine.includes("os:") || 
      lowerLine.includes("ip:") || 
      lowerLine.includes("user:") ||
      lowerLine.includes("cpu:") || 
      lowerLine.includes("ram:") || 
      lowerLine.includes("gpu:") ||
      lowerLine.includes("country:") || 
      lowerLine.includes("hwid:") ||
      lowerLine.includes("path:");
    
    // If it does NOT contain field pattern, then this is a separator
    if (!hasFieldPattern) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract section name from separator line (if exists)
 * Example: "----- Geolocation Data -----" -> "Geolocation Data"
 *         "----- Hardware Info -----" -> "Hardware Info"
 */
export function extractSectionFromSeparator(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  // Pattern: "----- Text -----" or "==== Text ===="
  const match = trimmed.match(/^[-=]{3,}\s+(.+?)\s+[-=]{3,}$/i);
  if (match) {
    return match[1].trim();
  }
  
  return null;
}

/**
 * Combine OS Name and OS Version into a single string
 * Handle various formats and cleaning
 */
export function combineOS(osName: string | null, osVersion: string | null): string | null {
  if (!osName && !osVersion) return null;
  if (osName && !osVersion) return osName;
  if (!osName && osVersion) return osVersion;
  
  // At this point, both osName and osVersion are guaranteed to be non-null
  // Clean OS Version
  const cleanVersion = (osVersion as string)
    .replace(/N\/A\s+Build\s+/i, '')  // Remove "N/A Build"
    .replace(/\s+Build\s+/i, ' ')     // Remove "Build" word
    .replace(/N\/A/gi, '')            // Remove "N/A"
    .trim();
  
  // Combine
  const combined = `${osName as string} ${cleanVersion}`.trim();
  
  // Validate combination result (minimum 5 characters for valid OS)
  if (combined.length < 5) {
    return osName || osVersion; // Fallback to existing value
  }
  
  return combined;
}

/**
 * Extract value from line with format "Label: Value"
 * Handle various separator formats and excessive spacing
 * Example: "IP:                      127.0.0.1"
 *         "CPU : Intel(R) Xeon(R) CPU E5-2686 v4 @ 2.30GHz"
 *         "IP Geolocation : 127.0.0.1 [India]"
 */
export function extractValue(line: string): string {
  // Find separator (colon, dash, or equals)
  // Prioritize colon as it's most common
  const colonIndex = line.indexOf(':');
  const dashIndex = line.indexOf('-');
  const equalsIndex = line.indexOf('=');
  
  let separatorIndex = -1;
  if (colonIndex !== -1) {
    separatorIndex = colonIndex;
  } else if (dashIndex !== -1 && dashIndex > 0) {
    separatorIndex = dashIndex;
  } else if (equalsIndex !== -1) {
    separatorIndex = equalsIndex;
  }
  
  if (separatorIndex !== -1) {
    // Extract value after separator
    // Handle excessive spacing (multiple spaces/tabs)
    let value = line.substring(separatorIndex + 1);
    
    // Remove leading spaces and tabs (may be multiple)
    value = value.replace(/^[\s\t]+/, '');
    
    return value.trim();
  }
  
  return line.trim();
}

/**
 * Normalize RAM format (optional)
 * Can also save as-is if normalization is not needed
 */
export function normalizeRAM(ram: string): string {
  if (!ram) return ram;
  
  // Extract number from string
  const match = ram.match(/(\d+(?:\.\d+)?)\s*(MB|GB|mb|gb)/i);
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    // Normalize to GB if needed
    if (unit === 'MB') {
      const gb = (value / 1024).toFixed(2);
      return `${gb} GB`;
    }
  }
  
  return ram; // Return as-is if cannot be normalized
}

/**
 * Extract country code from various formats
 * Now uses robust normalization via normalizeCountryToCode
 */
export function extractCountryCode(country: string): string {
  if (!country) return country;
  
  // Use robust normalization function
  const normalized = normalizeCountryToCode(country);
  
  // Return normalized code, or original if not found (backward compatibility)
  return normalized || country;
}

/**
 * Validate IP address format
 */
export function isValidIP(ip: string): boolean {
  if (!ip) return false;
  
  // Basic IP validation (IPv4)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // IPv6 basic check (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(ip)) {
    return true;
  }
  
  return false;
}

/**
 * Clean and validate value
 * Skip "Unknown", "[redacted]", etc.
 */
export function cleanValue(value: string | null): string | null {
  if (!value) return null;
  
  const cleaned = value.trim();
  
  // Skip invalid values
  const invalidValues = ['unknown', '[redacted]', 'n/a', 'none', 'null', ''];
  if (invalidValues.includes(cleaned.toLowerCase())) {
    return null;
  }
  
  return cleaned;
}

/**
 * Detect encoding and normalize to UTF-8
 */
export function normalizeEncoding(content: string): string {
  try {
    // Try to decode as UTF-8
    const decoded = decodeURIComponent(escape(content));
    return decoded;
  } catch (_error) {
    // If failed, return as-is (browser usually handles encoding)
    return content;
  }
}

/**
 * Extract username from format with domain
 * Example: "EC2AMAZ-75HN4R3/Administrator" -> "Administrator"
 */
export function extractUsername(username: string | null): string | null {
  if (!username) return null;
  
  // If there is "/", take the part after "/"
  const slashIndex = username.indexOf('/');
  if (slashIndex !== -1) {
    return username.substring(slashIndex + 1).trim();
  }
  
  // If there is "\\", take the part after "\\"
  const backslashIndex = username.indexOf('\\');
  if (backslashIndex !== -1) {
    return username.substring(backslashIndex + 1).trim();
  }
  
  return username.trim();
}

/**
 * Extract IP address from format with prefix/suffix
 * Example: "47.160.126.208/284629518" -> "47.160.126.208"
 */
export function extractIP(ip: string | null): string | null {
  if (!ip) return null;
  
  // If there is "/", take the part before "/"
  const slashIndex = ip.indexOf('/');
  if (slashIndex !== -1) {
    return ip.substring(0, slashIndex).trim();
  }
  
  return ip.trim();
}

