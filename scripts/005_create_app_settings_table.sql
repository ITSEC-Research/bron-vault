-- Create app_settings table for storing application configuration
-- Generic key-value model for extensible settings
CREATE TABLE IF NOT EXISTS app_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key_name (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default upload settings
INSERT INTO app_settings (key_name, value, description) VALUES
    ('upload_max_file_size', '10737418240', 'Maximum file upload size in bytes (default: 10GB)'),
    ('upload_chunk_size', '10485760', 'Chunk size for large file uploads in bytes (default: 10MB)'),
    ('upload_max_concurrent_chunks', '3', 'Maximum concurrent chunk uploads (default: 3)')
ON DUPLICATE KEY UPDATE key_name=key_name;

