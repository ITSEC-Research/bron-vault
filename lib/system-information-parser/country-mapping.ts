// Country normalization using i18n-iso-countries
// Maps various country name formats to ISO 3166-1 alpha-2 codes

import * as countries from 'i18n-iso-countries';
// @ts-ignore - JSON import
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register English locale
countries.registerLocale(enLocale);

/**
 * Map of country name variations, abbreviations, misspellings, and common names
 * to the official English country names recognized by ISO 3166-1
 * (and used by the 'i18n-iso-countries' library).
 *
 * KEYS: Always in lowercase.
 * VALUES: Official English country names (case-sensitive) understood by i18n.
 *
 * Strategy: This mapping serves as a preprocessing layer to clean up irregular
 * or messy input from malware logs before converting it to an ISO code using
 * i18n-iso-countries.
 */
export const COUNTRY_VARIATIONS: Record<string, string> = {
  // === PRIMARY COUNTRIES (MOST FREQUENTLY APPEARING) ===
  
  // United States
  'usa': 'United States',
  'u.s.a': 'United States',
  'u.s.a.': 'United States',
  'united states of america': 'United States',
  'america': 'United States',
  'us': 'United States', // 'US' will be handled by the code parser, but 'us' (lowercase) needs this entry
  
  // United Kingdom
  'uk': 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  'gb': 'United Kingdom',
  'britain': 'United Kingdom',
  'england': 'United Kingdom', // Technically less accurate, but in the logs 99% of the time it refers to the UK
  'scotland': 'United Kingdom', // // Same as above
  'wales': 'United Kingdom', // // Same as above
  'northern ireland': 'United Kingdom', // // Same as above
  
  // (United Arab Emirates
  'uae': 'United Arab Emirates',
  'u.a.e': 'United Arab Emirates',
  'arab emirate': 'United Arab Emirates', // Singular
  'arab emirates': 'United Arab Emirates', // Plural
  'dubai': 'United Arab Emirates', // Often the logs only include the city or emirate
  'abu dhabi': 'United Arab Emirates',
  
  // Russia
  'russian federation': 'Russia', // Long official name
  'russian': 'Russia',
  'rossiya': 'Russia', // Transliteration
  
  // China
  'peoples republic of china': 'China',
  'prc': 'China',
  'p.r.c.': 'China',
  
  // Republic of Korea
  'south korea': 'Korea, Republic of',
  'korea (south)': 'Korea, Republic of',
  'republic of korea': 'Korea, Republic of',
  'rok': 'Korea, Republic of',
  
  // Democratic People's Republic of Korea
  'north korea': 'Korea, Democratic People\'s Republic of',
  'korea (north)': 'Korea, Democratic People\'s Republic of',
  'dprk': 'Korea, Democratic People\'s Republic of',
  
  // Germany
  'deutschland': 'Germany', // Local name
  'germani': 'Germany', // Misspelling
  'gemany': 'Germany', // Misspelling
  
  // Belanda (Netherlands)
  'holland': 'Netherlands', // Incorrect common name
  'netherland': 'Netherlands', // Singular
  'nederland': 'Netherlands', // Local name
  
  // Saudi Arabia
  'ksa': 'Saudi Arabia', // Kingdom of Saudi Arabia
  'saudi': 'Saudi Arabia',
  
  // South Africa
  'rsa': 'South Africa', // Republic of South Africa
  's. africa': 'South Africa',
  
  // === LOCAL / NON-LATIN / FORMER NAMES ===
  
  'brasil': 'Brazil',
  'burma': 'Myanmar', // Former name
  'cote divoire': 'Côte d\'Ivoire',
  'côte d\'ivoire': 'Côte d\'Ivoire',
  'ivory coast': 'Côte d\'Ivoire', // Former or common name
  'espana': 'Spain',
  'espanha': 'Spain',
  'frace': 'France', // Misspelling
  'hellas': 'Greece',
  'italia': 'Italy',
  'japon': 'Japan',
  'magyarország': 'Hungary',
  'mexico': 'Mexico',
  'norge': 'Norway',
  'österreich': 'Austria',
  'polska': 'Poland',
  'portugual': 'Portugal', // Misspelling
  'suomi': 'Finland',
  'sverige': 'Sweden',
  'schweiz': 'Switzerland',
  'suisse': 'Switzerland',
  'svizzera': 'Switzerland',
  'turkey': 'Türkiye', // Official name change (needs verification with i18n)
  'turkiye': 'Türkiye',
  'zaire': 'Congo, Democratic Republic of the', // Former name
  
  // === "REPUBLIC OF" / "KINGDOM OF" VARIATIONS ===
  
  'iran': 'Iran, Islamic Republic of', // Common name → ISO name
  'syria': 'Syrian Arab Republic',
  'laos': 'Lao People\'s Democratic Republic',
  'vietnam': 'Viet Nam', // ISO name has space
  'viet nam': 'Viet Nam',
  'bolivia': 'Bolivia, Plurinational State of',
  'brunei': 'Brunei Darussalam',
  'falkland islands': 'Falkland Islands (Malvinas)',
  'macedonia': 'North Macedonia', // Official name change
  'micronesia': 'Micronesia, Federated States of',
  'moldova': 'Moldova, Republic of',
  'palestine': 'Palestine, State of',
  'taiwan': 'Taiwan, Province of China', // According to ISO
  'roc': 'Taiwan, Province of China', // Republic of China
  'tanzania': 'Tanzania, United Republic of',
  'venezuela': 'Venezuela, Bolivarian Republic of',
  'vatican': 'Holy See', // ISO name
  
  // === MISSPELLINGS / SMALL VARIATIONS ===
  
  'afganistan': 'Afghanistan',
  'albania': 'Albania',
  'algeria': 'Algeria',
  'argentina': 'Argentina',
  'columbia': 'Colombia', // Common misspelling
  'indonesi': 'Indonesia', // Often truncated
  'indo': 'Indonesia',
  'isreal': 'Israel', // Common misspelling
  'malasia': 'Malaysia',
  'pakis': 'Pakistan', // Often abbreviated
  'philipines': 'Philippines',
  'philippine': 'Philippines', // Singular
  'phillipines': 'Philippines', // Misspelling
  'singapre': 'Singapore',
  'slovak': 'Slovakia',
  'switz': 'Switzerland',
  'thai': 'Thailand',
  'ukranie': 'Ukraine',
  'yemen': 'Yemen',
};

/**
 * Normalize country name to ISO 3166-1 alpha-2 code
 * Handles various input formats from malware logs:
 * - ISO codes: "US", "AE"
 * - Mixed formats: "US (United States)", "Russia (RU)"
 * - With separators: "EG, Cairo", "US / United States"
 * - Locale format: "ru_RU"
 * - Country names: "United States", "Arab Emirate", "Italy"
 * - Variations: "USA", "UAE", "Holland", etc.
 * 
 * @param country - Country name or code (various formats)
 * @returns ISO 3166-1 alpha-2 code or null if not found
 */
export function normalizeCountryToCode(country: string | null): string | null {
  if (!country) return null;
  
  const trimmed = country.trim();
  if (!trimmed) return null;
  
  // 1. Check if already ISO code (2 uppercase letters)
  if (/^[A-Z]{2}$/.test(trimmed)) {
    // Validate if it's a valid ISO code
    try {
      const name = countries.getName(trimmed, 'en');
      if (name) {
        return trimmed;
      }
    } catch (e) {
      // Invalid code, continue to other checks
    }
  }
  
  // 2. Extract code from formats like "US (United States)" or "Russia (RU)"
  const codeMatch = trimmed.match(/\(([A-Z]{2})\)/);
  if (codeMatch) {
    const code = codeMatch[1];
    try {
      const name = countries.getName(code, 'en');
      if (name) {
        return code;
      }
    } catch (e) {
      // Invalid code, continue
    }
  }
  
  // 3. Extract code from format like "EG, Cairo" or "US / United States"
  const codeMatch2 = trimmed.match(/^([A-Z]{2})[,/\s]/);
  if (codeMatch2) {
    const code = codeMatch2[1];
    try {
      const name = countries.getName(code, 'en');
      if (name) {
        return code;
      }
    } catch (e) {
      // Invalid code, continue
    }
  }
  
  // 4. Extract code from format like "ru_RU" (locale format)
  const codeMatch3 = trimmed.match(/_([A-Z]{2})$/);
  if (codeMatch3) {
    const code = codeMatch3[1];
    try {
      const name = countries.getName(code, 'en');
      if (name) {
        return code;
      }
    } catch (e) {
      // Invalid code, continue
    }
  }
  
  // 5. Lookup by name (handle variations first)
  let countryName = trimmed;
  
  // Check variations mapping (lowercase untuk matching)
  const lowerCountry = countryName.toLowerCase();
  if (COUNTRY_VARIATIONS[lowerCountry]) {
    countryName = COUNTRY_VARIATIONS[lowerCountry];
  }
  
  // Try to get code by name (i18n-iso-countries)
  try {
    const code = countries.getAlpha2Code(countryName, 'en');
    if (code) {
      return code;
    }
  } catch (e) {
    // Continue to other lookup methods
  }
  
  // 6. Try case-insensitive lookup with all country names available
  // This handles case where name is not exact match but case-insensitive match
  try {
    const allCountries = countries.getNames('en', { select: 'official' });
    for (const [code, name] of Object.entries(allCountries)) {
      if (typeof name === 'string' && name.toLowerCase() === countryName.toLowerCase()) {
        return code;
      }
    }
  } catch (e) {
    // Continue to alternative names lookup
  }
  
  // 7. Try with alternative names (short names, common names)
  // i18n-iso-countries punya multiple name variants
  try {
    const allNames = countries.getNames('en');
    for (const [code, names] of Object.entries(allNames)) {
      if (Array.isArray(names)) {
        // Multiple names for same country
        if (names.some(n => typeof n === 'string' && n.toLowerCase() === countryName.toLowerCase())) {
          return code;
        }
      } else if (typeof names === 'string') {
        if (names.toLowerCase() === countryName.toLowerCase()) {
          return code;
        }
      }
    }
  } catch (e) {
    // Ignore error, continue to fallback
  }
  
  // 8. Fallback: return null (unknown country)
  // Note: Can also return original value for backward compatibility
  // But better to return null for consistency
  return null;
}

