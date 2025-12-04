-- =====================================================
-- Complete Database Schema
-- =====================================================
-- This script creates all tables, columns, indexes, and constraints
-- for the database specified in MYSQL_DATABASE environment variable.
-- Execute this script to set up a fresh database schema.
-- 
-- NOTE: Database must already exist (created by MySQL container from MYSQL_DATABASE env var).
-- This script will use the current database context.
-- =====================================================

-- Note: CREATE DATABASE is removed because:
-- 1. MySQL container automatically creates database from MYSQL_DATABASE environment variable
-- 2. This allows users to customize database name via .env file
-- 3. Scripts in /docker-entrypoint-initdb.d/ run after database creation
--
-- IMPORTANT: When run via Docker (docker-entrypoint-initdb.d), MySQL automatically
-- uses the database created from MYSQL_DATABASE environment variable.
-- If running this script manually, you must either:
--   a) Connect to the correct database first: USE your_database_name;
--   b) Or specify database when running: mysql -u user -p database_name < this_script.sql

-- =====================================================
-- Table: devices
-- =====================================================
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(500) NOT NULL,
    device_name_hash VARCHAR(64) NOT NULL,
    upload_batch VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_files INT DEFAULT 0,
    total_credentials INT DEFAULT 0,
    total_domains INT DEFAULT 0,
    total_urls INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_name (device_name),
    INDEX idx_device_name_hash (device_name_hash),
    INDEX idx_upload_batch (upload_batch),
    INDEX idx_upload_date (upload_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: files
-- =====================================================
CREATE TABLE IF NOT EXISTS files (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    parent_path TEXT,
    is_directory BOOLEAN DEFAULT FALSE,
    file_size INT DEFAULT 0,
    content LONGTEXT,
    local_file_path TEXT NULL,
    file_type ENUM('text', 'binary', 'unknown') DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_file_name (file_name),
    INDEX idx_created_at (created_at),
    INDEX idx_local_file_path (local_file_path(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Files table: metadata only. All file contents stored on disk via local_file_path';

-- =====================================================
-- Table: credentials
-- =====================================================
CREATE TABLE IF NOT EXISTS credentials (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    url TEXT,
    domain VARCHAR(255),
    tld VARCHAR(50),
    username VARCHAR(500),
    password TEXT,
    browser VARCHAR(255),
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_domain (domain),
    INDEX idx_tld (tld),
    INDEX idx_username (username),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: password_stats
-- =====================================================
CREATE TABLE IF NOT EXISTS password_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_count (count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: analytics_cache
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_data LONGTEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cache_key (cache_key),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: software
-- =====================================================
CREATE TABLE IF NOT EXISTS software (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    software_name VARCHAR(500) NOT NULL,
    version VARCHAR(500) NULL,
    source_file VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_software_name (software_name),
    INDEX idx_version (version),
    INDEX idx_source_file (source_file),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: systeminformation
-- =====================================================
CREATE TABLE IF NOT EXISTS systeminformation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL UNIQUE,
    stealer_type VARCHAR(100) NOT NULL DEFAULT 'Generic',
    os VARCHAR(500) NULL,
    ip_address VARCHAR(100) NULL,
    username VARCHAR(500) NULL,
    cpu VARCHAR(500) NULL,
    ram VARCHAR(100) NULL,
    computer_name VARCHAR(500) NULL,
    gpu VARCHAR(500) NULL,
    country VARCHAR(100) NULL,
    log_date VARCHAR(10) NULL COMMENT 'Normalized date in YYYY-MM-DD format',
    log_time VARCHAR(8) NOT NULL DEFAULT '00:00:00' COMMENT 'Normalized time in HH:mm:ss format (always string, default 00:00:00)',
    hwid VARCHAR(255) NULL,
    file_path TEXT NULL,
    antivirus VARCHAR(500) NULL,
    source_file VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_stealer_type (stealer_type),
    INDEX idx_os (os(255)),
    INDEX idx_ip_address (ip_address),
    INDEX idx_username (username(255)),
    INDEX idx_country (country),
    INDEX idx_hwid (hwid),
    INDEX idx_source_file (source_file),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: app_settings
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key_name (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table: users
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user
-- Default password: "admin" (bcrypt hash with salt rounds 12)
-- User dapat mengganti password ini setelah login pertama kali
INSERT INTO users (email, password_hash, name) VALUES 
    ('admin@bronvault.local', '$2b$12$V3YGoZlvgABmhIbt7H0ZyeygLONKnSe1TKuvp8OwEvc4u7nFWUUd.', 'Admin')
ON DUPLICATE KEY UPDATE email=email;

-- =====================================================
-- Performance Indexes
-- =====================================================
-- These indexes optimize queries for large datasets
-- Note: MySQL doesn't support "IF NOT EXISTS" for CREATE INDEX
-- So we use a stored procedure to safely create indexes

DELIMITER //

CREATE PROCEDURE CreateIndexIfNotExists(
    IN p_table_name VARCHAR(255),
    IN p_index_name VARCHAR(255),
    IN p_index_definition TEXT
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO index_exists
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name;
    
    IF index_exists = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', p_index_name, ' ON ', p_table_name, ' ', p_index_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

-- Composite index for browser analysis queries
CALL CreateIndexIfNotExists('credentials', 'idx_credentials_browser_device', '(browser, device_id)');

-- Composite index for TLD queries
CALL CreateIndexIfNotExists('credentials', 'idx_credentials_tld_device', '(tld, device_id)');

-- Index for files count query
CALL CreateIndexIfNotExists('files', 'idx_files_is_directory', '(is_directory)');

-- Composite index for password stats queries (critical for top passwords query)
-- Using prefix index on password (first 100 chars) for better performance
CALL CreateIndexIfNotExists('password_stats', 'idx_password_stats_password_device', '(password(100), device_id)');

-- Index for software queries
-- Using prefix indexes to avoid key length limit
CALL CreateIndexIfNotExists('software', 'idx_software_name_version_device', '(software_name(100), version(100), device_id)');

-- Index for domain and URL prefix searches (for domain-search optimization)
CALL CreateIndexIfNotExists('credentials', 'idx_credentials_domain_url_prefix', '(domain, url(255))');

-- Clean up stored procedure after use
DROP PROCEDURE IF EXISTS CreateIndexIfNotExists;

-- =====================================================
-- Schema Creation Complete
-- =====================================================
-- All tables, columns, indexes, and constraints have been created.
-- The database is now ready for use.
-- =====================================================

