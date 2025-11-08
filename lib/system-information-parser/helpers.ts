// Helper functions untuk System Information Parser

/**
 * Normalize line dengan menghapus dash prefix dan indent/tab
 * Handle berbagai format prefix yang umum di stealer logs:
 * - "- OS Version: ..." (dash prefix)
 * - "  OS Version: ..." (space indent)
 * - "\tOS Version: ..." (tab indent)
 * - "  - OS Version: ..." (space + dash)
 * - "\t- OS Version: ..." (tab + dash)
 */
export function normalizeLine(line: string): string {
  if (!line) return line;
  
  let normalized = line.trim();
  
  // Remove dash prefix jika ada (format: "- OS Version: ..." atau "  - OS Version: ...")
  normalized = normalized.replace(/^-\s*/, '');
  
  // Remove leading spaces dan tabs (indent)
  normalized = normalized.replace(/^[\s\t]+/, '');
  
  return normalized.trim();
}

/**
 * Deteksi apakah line adalah separator line
 * Handle berbagai format separator:
 * - "-------------" (dash separator)
 * - "==================================================" (equals separator)
 * - "----- Geolocation Data -----" (dash dengan text)
 * - "----- Hardware Info -----" (dash dengan text)
 */
export function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  
  // 1. Blank line adalah separator
  if (!trimmed) return true;
  
  // 2. Pure separator dengan repeated characters (= atau -)
  // Pattern: minimum 8 characters = atau - repeated, MUST BE PURE
  // Example: "========" atau "--------" atau "-------------"
  const pureSeparatorPattern = /^[=]{8,}$|^[-]{8,}$/;
  if (pureSeparatorPattern.test(trimmed)) {
    return true;
  }
  
  // 3. Separator dengan text di tengah (dash dengan text)
  // Pattern: "----- Text -----" atau "----- Geolocation Data -----"
  // - Starts with 3+ dashes
  // - Followed by text (bisa ada spaces)
  // - Ends with 3+ dashes
  const dashWithTextPattern = /^[-]{3,}\s+.+\s+[-]{3,}$/i;
  if (dashWithTextPattern.test(trimmed)) {
    return true;
  }
  
  // 4. Separator dengan text di tengah (equals dengan text)
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
 * Extract section name dari separator line (jika ada)
 * Contoh: "----- Geolocation Data -----" -> "Geolocation Data"
 *         "----- Hardware Info -----" -> "Hardware Info"
 */
export function extractSectionFromSeparator(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  // Pattern: "----- Text -----" atau "==== Text ===="
  const match = trimmed.match(/^[-=]{3,}\s+(.+?)\s+[-=]{3,}$/i);
  if (match) {
    return match[1].trim();
  }
  
  return null;
}

/**
 * Gabungkan OS Name dan OS Version menjadi satu string
 * Handle berbagai format dan cleaning
 */
export function combineOS(osName: string | null, osVersion: string | null): string | null {
  if (!osName && !osVersion) return null;
  if (osName && !osVersion) return osName;
  if (!osName && osVersion) return osVersion;
  
  // At this point, both osName and osVersion are guaranteed to be non-null
  // Clean OS Version
  let cleanVersion = (osVersion as string)
    .replace(/N\/A\s+Build\s+/i, '')  // Remove "N/A Build"
    .replace(/\s+Build\s+/i, ' ')     // Remove "Build" word
    .replace(/N\/A/gi, '')            // Remove "N/A"
    .trim();
  
  // Combine
  const combined = `${osName as string} ${cleanVersion}`.trim();
  
  // Validate hasil kombinasi (minimal 5 karakter untuk OS yang valid)
  if (combined.length < 5) {
    return osName || osVersion; // Fallback ke yang ada
  }
  
  return combined;
}

/**
 * Extract value dari line dengan format "Label: Value"
 * Handle berbagai format separator dan spacing yang banyak
 * Contoh: "IP:                      127.0.0.1"
 *         "CPU : Intel(R) Xeon(R) CPU E5-2686 v4 @ 2.30GHz"
 *         "IP Geolocation : 127.0.0.1 [India]"
 */
export function extractValue(line: string): string {
  // Cari separator (colon, dash, atau equals)
  // Prioritaskan colon karena paling umum
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
    // Extract value setelah separator
    // Handle spacing yang banyak (multiple spaces/tabs)
    let value = line.substring(separatorIndex + 1);
    
    // Remove leading spaces dan tabs (bisa banyak)
    value = value.replace(/^[\s\t]+/, '');
    
    return value.trim();
  }
  
  return line.trim();
}

/**
 * Normalize RAM format (optional)
 * Bisa juga simpan as-is jika tidak perlu normalisasi
 */
export function normalizeRAM(ram: string): string {
  if (!ram) return ram;
  
  // Extract angka dari string
  const match = ram.match(/(\d+(?:\.\d+)?)\s*(MB|GB|mb|gb)/i);
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    // Normalize ke GB jika perlu
    if (unit === 'MB') {
      const gb = (value / 1024).toFixed(2);
      return `${gb} GB`;
    }
  }
  
  return ram; // Return as-is jika tidak bisa dinormalisasi
}

/**
 * Extract country code dari berbagai format
 */
export function extractCountryCode(country: string): string {
  if (!country) return country;
  
  // Extract dari format "United States (US)" -> "US"
  const match = country.match(/\(([A-Z]{2})\)/);
  if (match) {
    return match[1];
  }
  
  // Jika sudah 2 karakter uppercase, kemungkinan sudah country code
  if (country.length === 2 && country === country.toUpperCase()) {
    return country;
  }
  
  return country; // Return as-is
}

/**
 * Validasi IP address format
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
 * Clean dan validasi nilai
 * Skip "Unknown", "[redacted]", dll
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
 * Deteksi encoding dan normalize ke UTF-8
 */
export function normalizeEncoding(content: string): string {
  try {
    // Coba decode sebagai UTF-8
    const decoded = decodeURIComponent(escape(content));
    return decoded;
  } catch (error) {
    // Jika gagal, return as-is (browser biasanya handle encoding)
    return content;
  }
}

/**
 * Extract username dari format dengan domain
 * Contoh: "EC2AMAZ-75HN4R3/Administrator" -> "Administrator"
 */
export function extractUsername(username: string | null): string | null {
  if (!username) return null;
  
  // Jika ada "/", ambil bagian setelah "/"
  const slashIndex = username.indexOf('/');
  if (slashIndex !== -1) {
    return username.substring(slashIndex + 1).trim();
  }
  
  // Jika ada "\\", ambil bagian setelah "\\"
  const backslashIndex = username.indexOf('\\');
  if (backslashIndex !== -1) {
    return username.substring(backslashIndex + 1).trim();
  }
  
  return username.trim();
}

/**
 * Extract IP address dari format dengan prefix/suffix
 * Contoh: "47.160.126.208/284629518" -> "47.160.126.208"
 */
export function extractIP(ip: string | null): string | null {
  if (!ip) return null;
  
  // Jika ada "/", ambil bagian sebelum "/"
  const slashIndex = ip.indexOf('/');
  if (slashIndex !== -1) {
    return ip.substring(0, slashIndex).trim();
  }
  
  return ip.trim();
}

