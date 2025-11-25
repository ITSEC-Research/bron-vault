-- Performance optimization indexes for dashboard queries
-- These indexes will significantly speed up queries on large datasets (millions/billions of rows)
--
-- NOTE: This script is OPTIONAL - indexes are created AUTOMATICALLY by the application!
-- The function ensurePerformanceIndexes() in lib/mysql.ts creates these indexes automatically
-- when the database is first initialized (during first upload) or when stats API is first called.
--
-- You only need to run this script manually if:
-- 1. You want to create indexes before first upload
-- 2. You're doing manual database setup
-- 3. You're troubleshooting index issues
--
-- For normal usage: Just run the app, indexes will be created automatically!

-- Composite index for browser analysis queries
-- Optimizes: SELECT browser, COUNT(DISTINCT device_id) FROM credentials WHERE browser IS NOT NULL GROUP BY browser
CREATE INDEX IF NOT EXISTS idx_credentials_browser_device ON credentials(browser, device_id);

-- Composite index for TLD queries  
-- Optimizes: SELECT tld, COUNT(*) FROM credentials WHERE tld IS NOT NULL GROUP BY tld
CREATE INDEX IF NOT EXISTS idx_credentials_tld_device ON credentials(tld, device_id);

-- Index for files count query
-- Optimizes: SELECT COUNT(*) FROM files WHERE is_directory = FALSE
CREATE INDEX IF NOT EXISTS idx_files_is_directory ON files(is_directory);

-- Composite index for password stats queries (critical for top passwords query)
-- Optimizes: SELECT password, COUNT(DISTINCT device_id) FROM password_stats WHERE password IS NOT NULL GROUP BY password
-- Note: Using prefix index on password (first 100 chars) for better performance
CREATE INDEX IF NOT EXISTS idx_password_stats_password_device ON password_stats(password(100), device_id);

-- Index for software queries
-- Optimizes: SELECT software_name, version, COUNT(DISTINCT device_id) FROM software GROUP BY software_name, version
CREATE INDEX IF NOT EXISTS idx_software_name_version_device ON software(software_name, version, device_id);

-- Index for device_name_hash (if not exists) - critical for unique/duplicate counts
CREATE INDEX IF NOT EXISTS idx_devices_name_hash ON devices(device_name_hash);

-- Index for upload_date (for recent devices and batch stats)
CREATE INDEX IF NOT EXISTS idx_devices_upload_date ON devices(upload_date);

