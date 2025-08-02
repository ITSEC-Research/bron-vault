-- Create devices table
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

-- Create files table
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    INDEX idx_device_id (device_id),
    INDEX idx_file_name (file_name),
    INDEX idx_created_at (created_at),
    FULLTEXT idx_content (content),
    INDEX idx_local_file_path (local_file_path(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create credentials table
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

-- Create password_stats table for top passwords
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

-- Create analytics cache table
CREATE TABLE IF NOT EXISTS analytics_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_data JSON,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cache_key (cache_key),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
