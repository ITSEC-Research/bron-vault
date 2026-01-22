/**
 * ISO Country Code Utilities
 * Handles conversion between ISO 3166-1 Alpha-2 and Alpha-3 codes
 * 
 * Database stores: Alpha-2 (US, ID, SG)
 * TopoJSON uses: Alpha-3 (USA, IDN, SGP) or Numeric IDs
 */

import * as countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register English locale
countries.registerLocale(enLocale);

/**
 * Convert ISO 3166-1 Alpha-2 code to Alpha-3 code
 * @param alpha2 - Two-letter country code (e.g., "US", "ID")
 * @returns Three-letter country code (e.g., "USA", "IDN") or null if invalid
 */
export function convertAlpha2ToAlpha3(alpha2: string | null): string | null {
  if (!alpha2 || alpha2.length !== 2) return null;
  
  try {
    const alpha3 = countries.getAlpha3Code(alpha2.toUpperCase(), 'en');
    return alpha3 || null;
  } catch {
    return null;
  }
}

/**
 * Convert ISO 3166-1 Alpha-3 code to Alpha-2 code
 * @param alpha3 - Three-letter country code (e.g., "USA", "IDN")
 * @returns Two-letter country code (e.g., "US", "ID") or null if invalid
 */
export function convertAlpha3ToAlpha2(alpha3: string | null): string | null {
  if (!alpha3 || alpha3.length !== 3) return null;
  
  try {
    const alpha2 = countries.getAlpha2Code(alpha3.toUpperCase(), 'en');
    return alpha2 || null;
  } catch {
    return null;
  }
}

/**
 * Get country name from ISO code (Alpha-2 or Alpha-3)
 * @param code - ISO country code (2 or 3 letters)
 * @returns Country name or null
 */
export function getCountryName(code: string | null): string | null {
  if (!code) return null;
  
  try {
    // Try as Alpha-2 first
    if (code.length === 2) {
      const name = countries.getName(code.toUpperCase(), 'en');
      return name || null;
    }
    
    // Try as Alpha-3
    if (code.length === 3) {
      const name = countries.getName(code.toUpperCase(), 'en', { select: 'official' });
      return name || null;
    }
  } catch {
    return null;
  }
  
  return null;
}

/**
 * Create a mapping object from Alpha-2 to Alpha-3 for fast lookup
 * @param alpha2Codes - Array of Alpha-2 codes
 * @returns Map object: { [alpha2]: alpha3 }
 */
export function createAlpha2ToAlpha3Map(alpha2Codes: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  
  for (const alpha2 of alpha2Codes) {
    const alpha3 = convertAlpha2ToAlpha3(alpha2);
    if (alpha3) {
      map[alpha2.toUpperCase()] = alpha3;
    }
  }
  
  return map;
}

/**
 * Validate if a code is a valid ISO Alpha-2 code
 */
export function isValidAlpha2(code: string | null): boolean {
  if (!code || code.length !== 2) return false;
  
  try {
    const name = countries.getName(code.toUpperCase(), 'en');
    return !!name;
  } catch {
    return false;
  }
}

/**
 * Validate if a code is a valid ISO Alpha-3 code
 */
export function isValidAlpha3(code: string | null): boolean {
  if (!code || code.length !== 3) return false;
  
  try {
    const name = countries.getName(code.toUpperCase(), 'en');
    return !!name;
  } catch {
    return false;
  }
}
