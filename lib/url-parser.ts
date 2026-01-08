// URL Parser Utility for Domain Reconnaissance
// Extracts subdomain, domain, path, and other URL components

export interface ParsedUrl {
  protocol: string | null
  fullHostname: string // e.g., "api.example.com" or "example.com"
  subdomain: string | null // e.g., "api" or null for base domain
  domain: string // e.g., "example.com"
  tld: string | null // e.g., "com"
  port: number | null
  path: string | null // Full path without query/fragment, e.g., "/login" or "/api/v1/users"
  query: string | null
  fragment: string | null
  baseDomain: string // domain.tld, e.g., "example.com"
}

/**
 * Check if a string is an IP address
 */
function isIpAddress(hostname: string): boolean {
  try {
    // IPv4 pattern
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipv4Regex.test(hostname)) {
      const parts = hostname.split('.')
      return parts.every(part => {
        const num = parseInt(part, 10)
        return num >= 0 && num <= 255
      })
    }
    
    // IPv6 basic check (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    if (ipv6Regex.test(hostname)) {
      return true
    }
    
    return false
  } catch {
    return false
  }
}

/**
 * Extract subdomain from hostname relative to base domain
 */
function extractSubdomain(hostname: string, baseDomain: string): string | null {
  if (!hostname || !baseDomain) return null
  if (hostname === baseDomain) return null
  
  // Remove base domain from hostname
  if (hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, -(baseDomain.length + 1))
    return subdomain || null
  }
  
  return null
}

/**
 * Normalize path - remove query params and fragments but keep full path structure
 */
function normalizePath(path: string): string {
  if (!path) return '/'
  
  // Remove query parameters
  const withoutQuery = path.split('?')[0]
  // Remove fragments
  const withoutFragment = withoutQuery.split('#')[0]
  
  // Ensure starts with /
  if (!withoutFragment.startsWith('/')) {
    return `/${withoutFragment}`
  }
  
  return withoutFragment || '/'
}

/**
 * Parse URL into components
 * Handles various URL formats and edge cases
 */
export function parseUrl(url: string): ParsedUrl {
  const defaultResult: ParsedUrl = {
    protocol: null,
    fullHostname: '',
    subdomain: null,
    domain: '',
    tld: null,
    port: null,
    path: null,
    query: null,
    fragment: null,
    baseDomain: '',
  }

  try {
    if (!url || url.trim() === '') {
      return defaultResult
    }

    let cleanUrl = url.trim()
    
    // Extract protocol
    let protocol: string | null = null
    if (cleanUrl.startsWith('http://')) {
      protocol = 'http'
      cleanUrl = cleanUrl.replace(/^http:\/\//, '')
    } else if (cleanUrl.startsWith('https://')) {
      protocol = 'https'
      cleanUrl = cleanUrl.replace(/^https:\/\//, '')
    }
    
    // Remove www prefix
    cleanUrl = cleanUrl.replace(/^www\./, '')
    
    // Extract hostname (everything before first /)
    const hostnamePart = cleanUrl.split('/')[0]
    const hostnameWithPort = hostnamePart.split(':')[0]
    const portMatch = hostnamePart.match(/:(\d+)$/)
    const port = portMatch ? parseInt(portMatch[1], 10) : null
    
    const hostname = hostnameWithPort.toLowerCase()
    
    // Extract path (everything after hostname)
    const pathStart = cleanUrl.indexOf('/')
    let path: string | null = null
    let query: string | null = null
    let fragment: string | null = null
    
    if (pathStart !== -1) {
      const pathPart = cleanUrl.substring(pathStart)
      path = normalizePath(pathPart)
      
      // Extract query
      const queryIndex = pathPart.indexOf('?')
      if (queryIndex !== -1) {
        const queryPart = pathPart.substring(queryIndex + 1)
        const fragmentIndex = queryPart.indexOf('#')
        if (fragmentIndex !== -1) {
          query = queryPart.substring(0, fragmentIndex)
          fragment = queryPart.substring(fragmentIndex + 1)
        } else {
          query = queryPart
        }
      } else {
        // Extract fragment only
        const fragmentIndex = pathPart.indexOf('#')
        if (fragmentIndex !== -1) {
          fragment = pathPart.substring(fragmentIndex + 1)
        }
      }
    } else {
      path = '/'
    }
    
    // Handle IP addresses
    if (isIpAddress(hostname)) {
      return {
        ...defaultResult,
        protocol,
        fullHostname: hostname,
        domain: hostname,
        baseDomain: hostname,
        port,
        path,
        query,
        fragment,
      }
    }
    
    // Extract domain and TLD
    const parts = hostname.split('.')
    if (parts.length < 2) {
      return {
        ...defaultResult,
        protocol,
        fullHostname: hostname,
        domain: hostname,
        baseDomain: hostname,
        port,
        path,
        query,
        fragment,
      }
    }
    
    // Get TLD (last part)
    const tld = parts[parts.length - 1]
    
    // Get base domain (last 2 parts: domain.tld)
    const baseDomain = parts.length >= 2 
      ? parts.slice(-2).join('.') 
      : hostname
    
    // Get full domain (could be subdomain.domain.tld)
    const _domain = hostname
    
    // Extract subdomain
    const subdomain = extractSubdomain(hostname, baseDomain)
    
    return {
      protocol,
      fullHostname: hostname,
      subdomain,
      domain: baseDomain, // Store base domain in domain field
      tld,
      port,
      path,
      query,
      fragment,
      baseDomain,
    }
  } catch (error) {
    console.error('Error parsing URL:', error)
    return defaultResult
  }
}

/**
 * Extract path from URL (without query and fragment)
 * This is used for path counting - NO deduplication
 */
export function extractPath(url: string): string {
  try {
    if (!url || url.trim() === '') {
      return '/'
    }
    
    let cleanUrl = url.trim()
    
    // Remove protocol
    cleanUrl = cleanUrl.replace(/^https?:\/\//, '')
    
    // Remove hostname (everything before first /)
    const pathStart = cleanUrl.indexOf('/')
    if (pathStart === -1) {
      return '/'
    }
    
    const pathPart = cleanUrl.substring(pathStart)
    
    // Remove query and fragment
    const path = normalizePath(pathPart)
    
    return path || '/'
  } catch (error) {
    console.error('Error extracting path:', error)
    return '/'
  }
}

/**
 * Extract full hostname from URL
 */
export function extractHostname(url: string): string {
  try {
    if (!url || url.trim() === '') {
      return ''
    }
    
    let cleanUrl = url.trim()
    
    // Remove protocol
    cleanUrl = cleanUrl.replace(/^https?:\/\//, '')
    
    // Remove www prefix
    cleanUrl = cleanUrl.replace(/^www\./, '')
    
    // Get hostname (everything before first / or :)
    const hostname = cleanUrl.split('/')[0].split(':')[0].toLowerCase()
    
    return hostname
  } catch (error) {
    console.error('Error extracting hostname:', error)
    return ''
  }
}

