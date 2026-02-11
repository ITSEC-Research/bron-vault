/**
 * Search Query Builder — ClickHouse WHERE-clause generator
 *
 * Takes a ParsedQuery (from query-parser.ts) and produces a parameterised
 * ClickHouse condition string **without** the leading WHERE / PREWHERE keyword.
 *
 * Each route is free to prepend WHERE, PREWHERE, or compose the condition with
 * additional AND / OR logic.
 */

import type { SearchTerm, ParsedQuery } from './query-parser'

export interface BuiltClause {
  /** SQL condition — never empty, defaults to '1=1'. Does NOT include WHERE. */
  condition: string
  /** Parameterised values keyed by their {name:Type} placeholders. */
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

function getColumnForField(field: NonNullable<SearchTerm['field']>): string {
  switch (field) {
    case 'domain': return 'c.domain'
    case 'user': return 'c.username'
    case 'url': return 'c.url'
    case 'browser': return 'c.browser'
    case 'password': return 'c.password'
  }
}

// ---------------------------------------------------------------------------
// Single-term condition builders
// ---------------------------------------------------------------------------

/**
 * Build SQL condition for a domain term with full subdomain matching.
 */
function buildDomainCondition(
  domain: string,
  matchType: SearchTerm['matchType'],
  prefix: string,
  params: Record<string, unknown>,
): string {
  // Normalise domain
  let nd = domain.trim().toLowerCase()
  nd = nd.replace(/^https?:\/\//, '')
  nd = nd.replace(/^www\./, '')
  nd = nd.replace(/\/$/, '')
  nd = nd.split('/')[0].split(':')[0]

  if (matchType === 'exact') {
    params[`${prefix}_d`] = nd
    return `c.domain = {${prefix}_d:String}`
  }

  if (matchType === 'wildcard') {
    const pattern = nd.replace(/\*/g, '%')
    params[`${prefix}_dw`] = pattern
    return `(c.domain ilike {${prefix}_dw:String} OR c.url ilike {${prefix}_dw:String})`
  }

  // Default: full subdomain matching (contains)
  params[`${prefix}_d`] = nd
  params[`${prefix}_p1`] = `%://${nd}/%`
  params[`${prefix}_p2`] = `%://${nd}:%`
  params[`${prefix}_p3`] = `%://%.${nd}/%`
  params[`${prefix}_p4`] = `%://%.${nd}:%`

  return `(
    c.domain = {${prefix}_d:String} OR
    c.domain ilike concat('%.', {${prefix}_d:String}) OR
    c.url ilike {${prefix}_p1:String} OR
    c.url ilike {${prefix}_p2:String} OR
    c.url ilike {${prefix}_p3:String} OR
    c.url ilike {${prefix}_p4:String}
  )`
}

/**
 * Build SQL condition for an email / username term.
 */
function buildEmailCondition(
  email: string,
  matchType: SearchTerm['matchType'],
  prefix: string,
  params: Record<string, unknown>,
): string {
  if (matchType === 'exact') {
    params[`${prefix}_e`] = email
    return `c.username = {${prefix}_e:String}`
  }

  if (matchType === 'wildcard') {
    params[`${prefix}_e`] = email.replace(/\*/g, '%')
    return `c.username ilike {${prefix}_e:String}`
  }

  params[`${prefix}_e`] = `%${email}%`
  return `c.username ilike {${prefix}_e:String}`
}

/**
 * Build SQL condition for a field-specific term.
 */
function buildFieldCondition(
  term: SearchTerm,
  prefix: string,
  params: Record<string, unknown>,
): string {
  // Delegate domain field to the subdomain-aware builder
  if (term.field === 'domain') {
    return buildDomainCondition(term.value, term.matchType, prefix, params)
  }

  const column = getColumnForField(term.field!)

  if (term.matchType === 'exact') {
    params[`${prefix}_f`] = term.value
    return `${column} = {${prefix}_f:String}`
  }

  if (term.matchType === 'wildcard') {
    params[`${prefix}_f`] = term.value.replace(/\*/g, '%')
    return `${column} ilike {${prefix}_f:String}`
  }

  params[`${prefix}_f`] = `%${term.value}%`
  return `${column} ilike {${prefix}_f:String}`
}

/**
 * Route a single SearchTerm to the appropriate builder.
 */
function buildTermCondition(
  term: SearchTerm,
  index: number,
  searchType: 'email' | 'domain',
  params: Record<string, unknown>,
): string {
  const prefix = `t${index}`

  if (term.field) {
    return buildFieldCondition(term, prefix, params)
  }

  if (searchType === 'email') {
    return buildEmailCondition(term.value, term.matchType, prefix, params)
  }

  return buildDomainCondition(term.value, term.matchType, prefix, params)
}

// ---------------------------------------------------------------------------
// Public builders
// ---------------------------------------------------------------------------

/**
 * Build complete WHERE condition for the main credential search (homepage).
 *
 * Works with both email and domain search types and respects all operators.
 * Returns condition **without** the `WHERE` keyword.
 */
export function buildSearchCondition(
  parsed: ParsedQuery,
  searchType: 'email' | 'domain',
): BuiltClause {
  const params: Record<string, unknown> = {}

  const includeClauses = parsed.includeTerms.map((term, i) =>
    buildTermCondition(term, i, searchType, params),
  )

  const excludeClauses = parsed.excludeTerms.map((term, i) =>
    buildTermCondition(term, i + 500, searchType, params),
  )

  let condition = ''

  if (includeClauses.length > 0) {
    condition =
      includeClauses.length === 1
        ? includeClauses[0]
        : `(${includeClauses.join(' OR ')})`
  }

  if (excludeClauses.length > 0) {
    const notParts = excludeClauses.map(c => `NOT (${c})`).join(' AND ')
    condition = condition ? `${condition} AND ${notParts}` : notParts
  }

  return { condition: condition || '1=1', params }
}

/**
 * Build a ClickHouse subquery that returns device_ids matching the parsed query,
 * supporting AND groups (devices must have credentials matching ALL terms in a group).
 *
 * When hasAndGroups is false, returns a simple WHERE-based subquery.
 * When hasAndGroups is true, uses GROUP BY + HAVING countIf for AND semantics.
 *
 * Returns a complete subquery string (including SELECT ... FROM ...) and params.
 */
export function buildDeviceIdSubquery(
  parsed: ParsedQuery,
  searchType: 'email' | 'domain',
): BuiltClause {
  const params: Record<string, unknown> = {}

  // If no AND groups, use the simple approach (backward compatible)
  if (!parsed.hasAndGroups) {
    const simple = buildSearchCondition(parsed, searchType)
    return {
      condition: `SELECT DISTINCT device_id FROM credentials c WHERE ${simple.condition}`,
      params: simple.params,
    }
  }

  // AND groups present — use GROUP BY + HAVING countIf approach
  // Strategy:
  // 1. WHERE: OR of ALL conditions (to pre-filter rows)
  // 2. GROUP BY device_id
  // 3. HAVING: for each AND group, countIf(term1) > 0 AND countIf(term2) > 0
  //    OR between groups
  //    AND NOT for exclude groups

  const allTermConditions: string[] = []
  const groupHavingClauses: string[] = []
  let termIdx = 0

  // Build include group conditions
  for (const group of parsed.includeGroups) {
    const termConditions: string[] = []
    for (const term of group.terms) {
      const cond = buildTermCondition(term, termIdx, searchType, params)
      allTermConditions.push(cond)
      termConditions.push(cond)
      termIdx++
    }

    if (group.terms.length === 1) {
      // Single term — just need countIf > 0
      groupHavingClauses.push(`countIf(${termConditions[0]}) > 0`)
    } else {
      // AND: all terms must match
      const andHaving = termConditions.map(c => `countIf(${c}) > 0`).join(' AND ')
      groupHavingClauses.push(`(${andHaving})`)
    }
  }

  // Build exclude group conditions
  const excludeHavingClauses: string[] = []
  for (const group of parsed.excludeGroups) {
    for (const term of group.terms) {
      const cond = buildTermCondition(term, termIdx + 500, searchType, params)
      allTermConditions.push(cond)
      excludeHavingClauses.push(`countIf(${cond}) > 0`)
      termIdx++
    }
  }

  // Combine WHERE (OR of everything to pre-filter)
  const whereCondition = allTermConditions.length > 0
    ? allTermConditions.join(' OR ')
    : '1=1'

  // Combine HAVING
  let havingClause = ''
  if (groupHavingClauses.length > 0) {
    havingClause = groupHavingClauses.length === 1
      ? groupHavingClauses[0]
      : `(${groupHavingClauses.join(' OR ')})`
  }
  if (excludeHavingClauses.length > 0) {
    const notPart = excludeHavingClauses.map(c => `NOT (${c})`).join(' AND ')
    havingClause = havingClause ? `${havingClause} AND ${notPart}` : notPart
  }

  const subquery = `SELECT device_id FROM credentials c WHERE ${whereCondition} GROUP BY device_id HAVING ${havingClause}`

  return { condition: subquery, params }
}

/**
 * Build WHERE condition for domain-recon routes (domain-only context).
 * All terms are treated as domain searches regardless of content.
 *
 * Options:
 *  - notNullCheck: append `AND c.domain IS NOT NULL`
 */
export function buildDomainReconCondition(
  parsed: ParsedQuery,
  opts?: { notNullCheck?: boolean },
): BuiltClause {
  const notNullCheck = opts?.notNullCheck ?? false
  const params: Record<string, unknown> = {}

  const includeClauses = parsed.includeTerms.map((term, i) => {
    const prefix = `d${i}`
    return buildDomainCondition(term.value, term.matchType, prefix, params)
  })

  const excludeClauses = parsed.excludeTerms.map((term, i) => {
    const prefix = `d${i + 500}`
    return buildDomainCondition(term.value, term.matchType, prefix, params)
  })

  let condition = ''

  if (includeClauses.length > 0) {
    condition =
      includeClauses.length === 1
        ? includeClauses[0]
        : `(${includeClauses.join(' OR ')})`
  }

  if (excludeClauses.length > 0) {
    const notParts = excludeClauses.map(c => `NOT (${c})`).join(' AND ')
    condition = condition ? `${condition} AND ${notParts}` : notParts
  }

  if (notNullCheck && condition) {
    condition = `(${condition}) AND c.domain IS NOT NULL`
  }

  return { condition: condition || '1=1', params }
}

/**
 * Build WHERE condition for keyword-based recon search (keyword mode in domain
 * recon). Supports multi-keyword OR via commas, exclusions, wildcards, etc.
 *
 * @param mode  'domain-only' searches hostname, 'full-url' searches entire URL
 */
export function buildKeywordReconCondition(
  parsed: ParsedQuery,
  mode: 'domain-only' | 'full-url' = 'full-url',
): BuiltClause {
  const params: Record<string, unknown> = {}

  const hostnameExpr = `if(
    length(domain(c.url)) > 0,
    domain(c.url),
    extract(c.url, '^(?:https?://)?([^/:]+)')
  )`

  const includeClauses = parsed.includeTerms.map((term, i) => {
    const prefix = `k${i}`

    if (term.matchType === 'exact') {
      params[`${prefix}_k`] = term.value
      if (mode === 'domain-only') {
        return `${hostnameExpr} = {${prefix}_k:String}`
      }
      return `c.url = {${prefix}_k:String}`
    }

    const pattern =
      term.matchType === 'wildcard'
        ? term.value.replace(/\*/g, '%')
        : `%${term.value}%`

    params[`${prefix}_k`] = pattern

    if (mode === 'domain-only') {
      return `(${hostnameExpr} ilike {${prefix}_k:String} OR c.domain ilike {${prefix}_k:String})`
    }
    return `(c.url ilike {${prefix}_k:String} OR c.domain ilike {${prefix}_k:String})`
  })

  const excludeClauses = parsed.excludeTerms.map((term, i) => {
    const prefix = `k${i + 500}`

    const pattern =
      term.matchType === 'exact'
        ? term.value
        : term.matchType === 'wildcard'
          ? term.value.replace(/\*/g, '%')
          : `%${term.value}%`

    params[`${prefix}_k`] = pattern

    if (term.matchType === 'exact') {
      if (mode === 'domain-only') {
        return `${hostnameExpr} = {${prefix}_k:String}`
      }
      return `c.url = {${prefix}_k:String}`
    }

    if (mode === 'domain-only') {
      return `(${hostnameExpr} ilike {${prefix}_k:String} OR c.domain ilike {${prefix}_k:String})`
    }
    return `(c.url ilike {${prefix}_k:String} OR c.domain ilike {${prefix}_k:String})`
  })

  let condition = ''

  if (includeClauses.length > 0) {
    condition =
      includeClauses.length === 1
        ? includeClauses[0]
        : `(${includeClauses.join(' OR ')})`
  }

  if (excludeClauses.length > 0) {
    const notParts = excludeClauses.map(c => `NOT (${c})`).join(' AND ')
    condition = condition ? `${condition} AND ${notParts}` : notParts
  }

  if (condition) {
    condition = `(${condition}) AND c.url IS NOT NULL`
  }

  return { condition: condition || 'c.url IS NOT NULL', params }
}
