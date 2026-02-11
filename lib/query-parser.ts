/**
 * Search Query Parser
 *
 * Parses search strings into structured terms supporting operators:
 *
 * | Operator       | Syntax         | Example                              |
 * |----------------|----------------|--------------------------------------|
 * | OR             | `,` (comma)    | example.com, test.com                |
 * | AND            | `+` (plus)     | example.com + test.com               |
 * | NOT            | `-` (prefix)   | example.com, -staging.example.com    |
 * | Wildcard       | `*`            | *.example.com, admin*@gmail.com      |
 * | Exact Match    | `"..."` (quotes)| "admin@example.com"                 |
 * | Field Prefix   | `field:value`  | domain:example.com user:admin        |
 *
 * Precedence: comma separates OR groups, `+` creates AND within a group.
 * Example: `a.com + b.com, c.com` → (a.com AND b.com) OR c.com
 *
 * Supported field prefixes:
 *   domain / d       → c.domain
 *   user / username / email / u → c.username
 *   url              → c.url
 *   browser / b      → c.browser
 *   password / pass / p → c.password
 */

export interface SearchTerm {
  /** The actual search value (already stripped of operators/quotes) */
  value: string
  /** Optional field restriction */
  field?: 'domain' | 'user' | 'url' | 'browser' | 'password'
  /** Whether to include (OR) or exclude (AND NOT) */
  operator: 'include' | 'exclude'
  /** How to match: exact =, contains ilike %v%, wildcard ilike pattern */
  matchType: 'exact' | 'contains' | 'wildcard'
}

/**
 * A group of SearchTerms joined by AND.
 * Multiple groups are joined by OR at the top level.
 */
export interface SearchGroup {
  /** Terms that must ALL match (AND logic) */
  terms: SearchTerm[]
  /** Whether this group is inclusive or exclusive */
  operator: 'include' | 'exclude'
}

export interface ParsedQuery {
  /** Groups of AND-joined terms, OR-joined at top level */
  groups: SearchGroup[]
  /** Flat list of all terms (convenience for backward compatibility) */
  terms: SearchTerm[]
  originalQuery: string
  hasFieldPrefixes: boolean
  /** True if any include group has more than 1 term (AND semantics needed) */
  hasAndGroups: boolean
  /** Convenience: flat include terms */
  includeTerms: SearchTerm[]
  /** Convenience: flat exclude terms */
  excludeTerms: SearchTerm[]
  /** Convenience: include groups */
  includeGroups: SearchGroup[]
  /** Convenience: exclude groups */
  excludeGroups: SearchGroup[]
}

const FIELD_ALIASES: Record<string, SearchTerm['field']> = {
  domain: 'domain',
  d: 'domain',
  user: 'user',
  username: 'user',
  u: 'user',
  email: 'user',
  url: 'url',
  browser: 'browser',
  b: 'browser',
  password: 'password',
  pass: 'password',
  p: 'password',
}

/**
 * Parse a single raw term string into a SearchTerm.
 */
function parseSingleTerm(raw: string): { term: SearchTerm | null; hasFieldPrefix: boolean } {
  let term = raw.trim()
  if (!term) return { term: null, hasFieldPrefix: false }

  let operator: SearchTerm['operator'] = 'include'
  let matchType: SearchTerm['matchType'] = 'contains'
  let field: SearchTerm['field'] | undefined
  let hasFieldPrefix = false

  // NOT (- prefix) — only at the group level, but handle here for robustness
  if (term.startsWith('-') && term.length > 1) {
    operator = 'exclude'
    term = term.substring(1).trim()
    if (!term) return { term: null, hasFieldPrefix: false }
  }

  // Exact match ("...")
  if (term.startsWith('"') && term.endsWith('"') && term.length >= 2) {
    matchType = 'exact'
    term = term.slice(1, -1)
    if (!term) return { term: null, hasFieldPrefix: false }
  } else {
    // Field prefix (field:value)
    const fieldMatch = term.match(/^(\w+):(.+)$/)
    if (fieldMatch) {
      const fieldName = fieldMatch[1].toLowerCase()
      const fieldValue = fieldMatch[2].trim()
      if (FIELD_ALIASES[fieldName]) {
        field = FIELD_ALIASES[fieldName]
        term = fieldValue
        hasFieldPrefix = true
        // Re-check for exact match on value
        if (term.startsWith('"') && term.endsWith('"') && term.length >= 2) {
          matchType = 'exact'
          term = term.slice(1, -1)
        }
      }
    }
  }

  // Wildcard (*)
  if (matchType !== 'exact' && term.includes('*')) {
    matchType = 'wildcard'
  }

  if (!term) return { term: null, hasFieldPrefix: false }
  return { term: { value: term, field, operator, matchType }, hasFieldPrefix }
}

/**
 * Parse a search query string into structured SearchTerms and SearchGroups.
 *
 * Comma-separated segments are OR groups.
 * Plus (+) within a segment creates AND terms within a group.
 * A leading `-` marks a NOT (exclude) group.
 * Wrapping in double-quotes makes the term an exact match.
 * An `*` inside an unquoted term becomes a wildcard (SQL %).
 * A `field:value` prefix restricts the search to a specific column.
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const originalQuery = query
  const groups: SearchGroup[] = []
  let hasFieldPrefixes = false

  // Split by comma for OR groups
  const segments = query.split(',')

  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    // Determine group-level operator (exclude if starts with -)
    let groupOperator: SearchGroup['operator'] = 'include'
    let segmentContent = trimmed
    if (trimmed.startsWith('-') && trimmed.length > 1) {
      // Check if this is a group-level exclude or just a single exclude term
      // If the segment contains +, it's a group with potential AND
      groupOperator = 'exclude'
      segmentContent = trimmed.substring(1).trim()
    }

    // Split by + for AND terms within this group
    const andParts = segmentContent.split('+')

    const groupTerms: SearchTerm[] = []
    for (const part of andParts) {
      const { term, hasFieldPrefix } = parseSingleTerm(part)
      if (term) {
        // Override the term's operator with the group's operator
        term.operator = groupOperator
        groupTerms.push(term)
        if (hasFieldPrefix) hasFieldPrefixes = true
      }
    }

    if (groupTerms.length > 0) {
      groups.push({ terms: groupTerms, operator: groupOperator })
    }
  }

  // Build flat term list for backward compatibility
  const terms = groups.flatMap(g => g.terms)
  const includeGroups = groups.filter(g => g.operator === 'include')
  const excludeGroups = groups.filter(g => g.operator === 'exclude')
  const hasAndGroups = includeGroups.some(g => g.terms.length > 1)

  return {
    groups,
    terms,
    originalQuery,
    hasFieldPrefixes,
    hasAndGroups,
    includeTerms: terms.filter(t => t.operator === 'include'),
    excludeTerms: terms.filter(t => t.operator === 'exclude'),
    includeGroups,
    excludeGroups,
  }
}

/**
 * Detect the overall search type from a parsed query.
 */
export function detectQueryType(parsed: ParsedQuery): 'email' | 'domain' | 'mixed' {
  if (parsed.hasFieldPrefixes) return 'mixed'

  const hasEmail = parsed.terms.some(t => t.value.includes('@'))
  const hasDomain = parsed.terms.some(t => t.value.includes('.') && !t.value.includes('@'))

  if (hasEmail && hasDomain) return 'mixed'
  if (hasEmail) return 'email'
  return 'domain'
}

/**
 * Check whether a raw query string contains any operator characters.
 */
export function hasOperators(query: string): boolean {
  return /[,*"+]/.test(query) || /^-/.test(query.trim()) || /,\s*-/.test(query) || /\w+:\S/.test(query)
}
