-- =====================================================
-- Complete Database Schema for bronvaultnew
-- =====================================================
-- This script creates all tables, columns, indexes, and constraints
-- for the bronvaultnew database.
-- Execute this script to set up a fresh database schema.
-- =====================================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS bronvaultnew CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE bronvaultnew;

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
    log_date VARCHAR(100) NULL,
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
-- Performance Indexes
-- =====================================================
-- These indexes optimize queries for large datasets

-- Composite index for browser analysis queries
CREATE INDEX IF NOT EXISTS idx_credentials_browser_device ON credentials(browser, device_id);

-- Composite index for TLD queries
CREATE INDEX IF NOT EXISTS idx_credentials_tld_device ON credentials(tld, device_id);

-- Index for files count query
CREATE INDEX IF NOT EXISTS idx_files_is_directory ON files(is_directory);

-- Composite index for password stats queries (critical for top passwords query)
-- Using prefix index on password (first 100 chars) for better performance
CREATE INDEX IF NOT EXISTS idx_password_stats_password_device ON password_stats(password(100), device_id);

-- Index for software queries
-- Using prefix indexes to avoid key length limit
CREATE INDEX IF NOT EXISTS idx_software_name_version_device ON software(software_name(100), version(100), device_id);

-- Index for domain and URL prefix searches (for domain-search optimization)
CREATE INDEX IF NOT EXISTS idx_credentials_domain_url_prefix ON credentials(domain, url(255));

-- =====================================================
-- Schema Creation Complete
-- =====================================================
-- All tables, columns, indexes, and constraints have been created.
-- The database is now ready for use.
-- =====================================================

