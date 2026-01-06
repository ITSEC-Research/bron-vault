-- =====================================================
-- Migration: Add TOTP/2FA columns to users table
-- Run: mysql -u root -p bronvault < scripts/011_add_totp_columns.sql
-- =====================================================

-- Add TOTP secret column (stores the base32 encoded secret)
-- Admin can view this in DB for recovery purposes
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255) DEFAULT NULL;

-- Add TOTP enabled flag (admin can set to false to disable 2FA)
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;

-- Add backup codes (JSON array of 10 one-time codes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT DEFAULT NULL;

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_totp_enabled ON users(totp_enabled);

-- Verify columns were added
SELECT 'Migration 011_add_totp_columns completed successfully' AS status;
DESCRIBE users;
