-- Create database
CREATE DATABASE IF NOT EXISTS stealer_logs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE stealer_logs;

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(500) NOT NULL,
  upload_batch VARCHAR(255) NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_files INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_name (device_name),
  INDEX idx_upload_batch (upload_batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  parent_path TEXT,
  is_directory BOOLEAN DEFAULT FALSE,
  file_size INT DEFAULT 0,
  content LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
  INDEX idx_device_id (device_id),
  INDEX idx_file_name (file_name),
  FULLTEXT idx_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create search_cache table for faster searches
CREATE TABLE IF NOT EXISTS search_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  search_query VARCHAR(500) NOT NULL,
  search_type ENUM('email', 'domain') NOT NULL,
  results JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_search (search_query, search_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
