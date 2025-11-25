// Password escape/unescape functions for handling special characters
export function escapePassword(password: string): string {
  if (!password) return password
  
  // Escape special characters that could cause parsing issues
  return password
    .replace(/\\/g, '\\\\')  // Escape backslash first
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t')   // Escape tabs
    .replace(/\0/g, '\\0')   // Escape null bytes
}

export function unescapePassword(escapedPassword: string): string {
  if (!escapedPassword) return escapedPassword
  
  // Unescape special characters
  return escapedPassword
    .replace(/\\0/g, '\0')   // Unescape null bytes
    .replace(/\\t/g, '\t')   // Unescape tabs
    .replace(/\\r/g, '\r')   // Unescape carriage returns
    .replace(/\\n/g, '\n')   // Unescape newlines
    .replace(/\\"/g, '"')    // Unescape double quotes
    .replace(/\\'/g, "'")    // Unescape single quotes
    .replace(/\\\\/g, '\\')  // Unescape backslash last
}

// Helper function to detect passwords with special characters
export function hasSpecialCharacters(password: string): boolean {
  if (!password) return false
  
  // Check for common special characters that might cause issues
  const specialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/
  return specialChars.test(password)
}

// Helper function to safely log password information
export function logPasswordInfo(password: string, context: string): void {
  if (!password) return
  
  const hasSpecial = hasSpecialCharacters(password)
  const length = password.length
  
  if (hasSpecial) {
    console.log(`🔐 ${context}: Password with special characters (length: ${length})`)
  } else {
    console.log(`🔐 ${context}: Standard password (length: ${length})`)
  }
}

// Maximum username length in database (VARCHAR(500))
const MAX_USERNAME_LENGTH = 500

/**
 * Truncate username to fit database VARCHAR(500) constraint
 * Returns truncated username and logs warning if truncation occurred
 * @param username - The username to truncate
 * @param context - Context for logging (e.g., file path or URL)
 * @returns Object with truncated username and whether truncation occurred
 */
export function truncateUsername(
  username: string | null | undefined,
  context?: string
): { username: string; wasTruncated: boolean; originalLength: number } {
  if (!username) {
    return { username: username || "", wasTruncated: false, originalLength: 0 }
  }

  const originalLength = username.length

  if (originalLength <= MAX_USERNAME_LENGTH) {
    return { username, wasTruncated: false, originalLength }
  }

  // Truncate to max length
  const truncated = username.substring(0, MAX_USERNAME_LENGTH)
  
  // Log warning with context
  const contextInfo = context ? ` (${context})` : ""
  console.warn(
    `⚠️ Username truncated from ${originalLength} to ${MAX_USERNAME_LENGTH} characters${contextInfo}. ` +
    `Original: "${username.substring(0, 50)}..." → Truncated: "${truncated.substring(0, 50)}..."`
  )

  return {
    username: truncated,
    wasTruncated: true,
    originalLength,
  }
}

export function analyzePasswordFile(content: string): {
  credentialCount: number
  domainCount: number
  urlCount: number
  passwordCounts: Map<string, number>
  credentials: Array<{
    url: string
    domain: string | null
    tld: string | null
    username: string
    password: string
    browser: string | null
  }>
} {
  const result = {
    credentialCount: 0,
    domainCount: 0,
    urlCount: 0,
    passwordCounts: new Map<string, number>(),
    credentials: [] as Array<{
      url: string
      domain: string | null
      tld: string | null
      username: string
      password: string
      browser: string | null
    }>,
  }

  if (!content || content.trim().length === 0) {
    return result
  }

  const lines = content.split(/\r?\n/)

  // Count passwords (case insensitive)
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    const lowerLine = trimmedLine.toLowerCase()

    // Count credentials by looking for "password:" or "pass:"
    if (lowerLine.includes("password:") || lowerLine.includes("pass:")) {
      const password = extractValue(trimmedLine)
      if (password && password.length > 0) {
        // Validate password for special characters
        try {
          // Test if password can be safely processed
          const testEscape = escapePassword(password)
          if (testEscape !== null && testEscape !== undefined) {
            result.credentialCount++
            result.passwordCounts.set(password, (result.passwordCounts.get(password) || 0) + 1)
          }
        } catch (escapeError) {
          // Skip invalid passwords that cause escape errors
          console.warn(`Skipping password with invalid characters: ${password.substring(0, 10)}...`)
        }
      }
    }

    // Count URLs and domains
    if (lowerLine.includes("url:") || lowerLine.includes("host:") || lowerLine.includes("hostname:")) {
      const url = extractValue(trimmedLine)
      if (url && url.length > 0) {
        result.urlCount++

        // Check if it's not an IP address for domain count
        if (!isIpAddress(url)) {
          result.domainCount++
        }
      }
    }
  }

  // Parse credentials
  let currentCredential: Partial<{
    url: string
    username: string
    password: string
    browser: string
  }> = {}

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Detect separator (blank line, pure separator, or branded separator)
    if (isSeparatorLine(trimmedLine)) {
      if (isValidCredentialFlexible(currentCredential)) {
        const urlInfo = extractUrlInfo(currentCredential.url!)
        result.credentials.push({
          url: currentCredential.url!,
          domain: urlInfo.domain,
          tld: urlInfo.tld,
          username: currentCredential.username!,
          password: currentCredential.password!,
          browser: currentCredential.browser || null,
        })
      }
      currentCredential = {}
      continue
    }

    const lowerLine = trimmedLine.toLowerCase()

    if (lowerLine.includes("url:") || lowerLine.includes("host:") || lowerLine.includes("hostname:")) {
      // If URL already exists, save previous credential first
      if (currentCredential.url) {
        if (isValidCredentialFlexible(currentCredential)) {
          const urlInfo = extractUrlInfo(currentCredential.url!)
          result.credentials.push({
            url: currentCredential.url!,
            domain: urlInfo.domain,
            tld: urlInfo.tld,
            username: currentCredential.username!,
            password: currentCredential.password!,
            browser: currentCredential.browser || null,
          })
        }
        currentCredential = {}
      }
      // Set the new URL
      currentCredential.url = extractValue(trimmedLine)
    } else if (lowerLine.includes("username:") || lowerLine.includes("user:") || lowerLine.includes("login:")) {
      currentCredential.username = extractValue(trimmedLine)
    } else if (lowerLine.includes("password:") || lowerLine.includes("pass:")) {
      const password = extractValue(trimmedLine)
      // Validate password for special characters
      // Allow empty password ("") as long as Password: field exists
      try {
        const testEscape = escapePassword(password)
        // Set password even if empty (""), because "" !== undefined
        // escapePassword("") returns "" (valid), so set it directly
        currentCredential.password = password
      } catch (escapeError) {
        // Skip invalid passwords that cause errors
        console.warn(`Skipping invalid password: ${password.substring(0, 10)}...`)
      }
    } else if (lowerLine.includes("browser:") || lowerLine.includes("soft:") || lowerLine.includes("application:")) {
      currentCredential.browser = extractValue(trimmedLine)
    }
  }

  // Add the last credential if valid
  if (isValidCredentialFlexible(currentCredential)) {
    const urlInfo = extractUrlInfo(currentCredential.url!)
    result.credentials.push({
      url: currentCredential.url!,
      domain: urlInfo.domain,
      tld: urlInfo.tld,
      username: currentCredential.username!,
      password: currentCredential.password!,
      browser: currentCredential.browser || null,
    })
  }

  return result
}

export function isValidCredentialFlexible(
  credential: Partial<{
    url: string
    username: string
    password: string
    browser: string
  }>,
): credential is { url: string; username: string; password: string; browser?: string } {
  return !!(credential.url && credential.username && credential.password !== undefined)
}

export function isIpAddress(url: string): boolean {
  try {
    let hostname = url.trim()
    hostname = hostname.replace(/^https?:\/\//, "")
    hostname = hostname.split("/")[0]
    hostname = hostname.split(":")[0]

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    return ipRegex.test(hostname)
  } catch (error) {
    return false
  }
}

export function extractUrlInfo(url: string): { domain: string | null; tld: string | null } {
  try {
    if (!url || url.trim() === "") {
      return { domain: null, tld: null }
    }

    let cleanUrl = url.trim()
    cleanUrl = cleanUrl.replace(/^https?:\/\//, "")
    cleanUrl = cleanUrl.replace(/^www\./, "")

    const hostname = cleanUrl.split("/")[0].split(":")[0].toLowerCase()

    if (isIpAddress(url)) {
      return { domain: hostname, tld: null }
    }

    const parts = hostname.split(".")
    if (parts.length >= 2) {
      const tld = parts[parts.length - 1]
      const domain = parts.length > 2 ? parts.slice(-2).join(".") : hostname
      return { domain, tld }
    }

    return { domain: hostname, tld: null }
  } catch (error) {
    return { domain: null, tld: null }
  }
}

export function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim()
  
  // 1. Blank line is still considered a separator
  if (!trimmed) return true
  
  // 2. Detect separator with repeated characters (= or -)
  // Pattern: minimum 8 characters = or - repeated, MUST BE PURE
  // Example: "========" or "--------"
  const pureSeparatorPattern = /^[=]{8,}$|^[-]{8,}$/
  if (pureSeparatorPattern.test(trimmed)) {
    return true
  }
  
  // 3. Detect "Branded" separator (e.g., ====Daisy====)
  // Pattern:
  // - Starts with 8+ characters (= or -)
  // - Followed by 1+ characters *anything* (text in the middle)
  // - Ends with 8+ characters (= or -)
  const brandedSeparatorPattern = /^[=]{8,}.+[=]{8,}$|^[-]{8,}.+[-]{8,}$/
  if (brandedSeparatorPattern.test(trimmed)) {
    // Ensure line does NOT contain credential field pattern
    // If it contains field pattern, then it's NOT a separator
    const lowerLine = trimmed.toLowerCase()
    const hasFieldPattern = 
      lowerLine.includes("url:") || 
      lowerLine.includes("host:") || 
      lowerLine.includes("hostname:") ||
      lowerLine.includes("username:") || 
      lowerLine.includes("user:") || 
      lowerLine.includes("login:") ||
      lowerLine.includes("password:") || 
      lowerLine.includes("pass:") ||
      lowerLine.includes("browser:") || 
      lowerLine.includes("soft:") || 
      lowerLine.includes("application:")
    
    // If it does NOT contain field pattern, then this is a branded separator
    if (!hasFieldPattern) {
      return true
    }
  }
  
  return false
}

export function extractValue(line: string): string {
  const colonIndex = line.indexOf(":")
  if (colonIndex !== -1) {
    const value = line.substring(colonIndex + 1).trim()
    
    // Handle special characters in password values
    // Check if this looks like a password field
    const lowerLine = line.toLowerCase()
    if (lowerLine.includes("password:") || lowerLine.includes("pass:")) {
      // For password fields, we need to be more careful with special characters
      // but we don't escape here - we'll handle it during database insertion
      return value
    }
    
    return value
  }
  return line.trim()
}

