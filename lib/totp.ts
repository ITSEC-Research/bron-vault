/**
 * TOTP (Time-based One-Time Password) Utility
 * 
 * Provides functions for generating and verifying TOTP codes
 * Compatible with Google Authenticator, Authy, etc.
 * 
 * Design decisions:
 * - Secret is stored in DB (admin can recover/view)
 * - totp_enabled flag allows easy disable via DB update
 * - Backup codes stored as JSON array
 */

import * as OTPAuth from 'otpauth'
import * as QRCode from 'qrcode'
import crypto from 'crypto'

// App name shown in authenticator apps
const APP_NAME = 'BronVault'

/**
 * Generate a new TOTP secret
 * Returns base32 encoded secret
 */
export function generateTOTPSecret(): string {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: 'User',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }) // 160 bits
  })
  
  return totp.secret.base32
}

/**
 * Generate TOTP URI for QR code
 * @param secret - Base32 encoded secret
 * @param email - User's email (shown in authenticator)
 */
export function generateTOTPUri(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  })
  
  return totp.toString()
}

/**
 * Generate QR code as data URL
 * @param secret - Base32 encoded secret
 * @param email - User's email
 */
export async function generateQRCode(secret: string, email: string): Promise<string> {
  const uri = generateTOTPUri(secret, email)
  return await QRCode.toDataURL(uri, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  })
}

/**
 * Verify a TOTP code
 * @param secret - Base32 encoded secret
 * @param token - 6-digit code from user
 * @param window - Number of periods to check (default: 0 = only current 30-second window)
 * 
 * SECURITY NOTE: 
 * - window: 0 = Only accepts current 30-second code (strictest)
 * - window: 1 = Accepts ±1 period (~90 seconds total) - recommended for clock drift tolerance
 * - Using window: 0 for maximum security - code expires exactly when authenticator shows new code
 */
export function verifyTOTP(secret: string, token: string, window: number = 0): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      label: 'User',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    })
    
    // Returns delta (number of periods) or null if invalid
    // With window: 0, only accepts the current period's code
    const delta = totp.validate({ token, window })
    return delta !== null
  } catch (error) {
    console.error('TOTP verification error:', error)
    return false
  }
}

/**
 * Generate backup codes (10 random 8-character codes)
 * These are one-time use codes for recovery
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  
  for (let i = 0; i < count; i++) {
    // SECURITY: Generate random 12-character code (6 bytes = 48 bits of entropy) (MED-04)
    const code = crypto.randomBytes(6).toString('hex').toUpperCase()
    codes.push(code)
  }
  
  return codes
}

/**
 * Verify a backup code and return remaining codes if valid
 * @param backupCodes - Array of backup codes
 * @param code - Code to verify
 * @returns Object with isValid and remaining codes
 */
export function verifyBackupCode(
  backupCodes: string[],
  code: string
): { isValid: boolean; remainingCodes: string[] } {
  const normalizedCode = code.toUpperCase().replace(/\s/g, '')
  const index = backupCodes.findIndex(c => c === normalizedCode)
  
  if (index === -1) {
    return { isValid: false, remainingCodes: backupCodes }
  }
  
  // Remove used code
  const remainingCodes = [...backupCodes]
  remainingCodes.splice(index, 1)
  
  return { isValid: true, remainingCodes }
}

/**
 * Format backup codes for display (add dash in middle)
 */
export function formatBackupCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * Get current TOTP code (for testing/debug purposes only)
 * SECURITY: Only available in test/development environment (MED-03)
 */
export function getCurrentTOTP(secret: string): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('getCurrentTOTP is not available in production')
  }
  
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: 'User',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  })
  
  return totp.generate()
}
