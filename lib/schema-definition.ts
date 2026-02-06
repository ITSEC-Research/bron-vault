/**
 * Database Schema Definition - Single Source of Truth
 * 
 * This file defines the expected database schema for the current application version.
 * Used by the database sync feature to validate and migrate the database.
 * 
 * Schema Version: 1.0.0
 */

export const SCHEMA_VERSION = "1.2.0"

// Column definition type
export interface ColumnDefinition {
  name: string
  type: string
  nullable: boolean
  default?: string | null
  extra?: string  // AUTO_INCREMENT, etc.
  key?: 'PRI' | 'UNI' | 'MUL' | null
  comment?: string
}

// Index definition type
export interface IndexDefinition {
  name: string
  columns: string[]
  unique: boolean
  type?: string  // BTREE, FULLTEXT, etc.
}

// Foreign key definition
export interface ForeignKeyDefinition {
  name: string
  column: string
  referencedTable: string
  referencedColumn: string
  onDelete: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT'
  onUpdate: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT'
}

// Table definition type
export interface TableDefinition {
  name: string
  columns: ColumnDefinition[]
  indexes: IndexDefinition[]
  foreignKeys: ForeignKeyDefinition[]
  engine?: string
  charset?: string
  collate?: string
  comment?: string
}

// ===========================================
// TABLE DEFINITIONS
// ===========================================

export const DEVICES_TABLE: TableDefinition = {
  name: 'devices',
  columns: [
    { name: 'id', type: 'int', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'device_id', type: 'varchar(255)', nullable: false, key: 'UNI' },
    { name: 'device_name', type: 'varchar(500)', nullable: false },
    { name: 'device_name_hash', type: 'varchar(64)', nullable: false },
    { name: 'upload_batch', type: 'varchar(255)', nullable: false },
    { name: 'upload_date', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
    { name: 'total_files', type: 'int', nullable: true, default: '0' },
    { name: 'total_credentials', type: 'int', nullable: true, default: '0' },
    { name: 'total_domains', type: 'int', nullable: true, default: '0' },
    { name: 'total_urls', type: 'int', nullable: true, default: '0' },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'device_id', columns: ['device_id'], unique: true },
    { name: 'idx_device_name', columns: ['device_name'], unique: false },
    { name: 'idx_device_name_hash', columns: ['device_name_hash'], unique: false },
    { name: 'idx_upload_batch', columns: ['upload_batch'], unique: false },
    { name: 'idx_upload_date', columns: ['upload_date'], unique: false },
  ],
  foreignKeys: [],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

export const FILES_TABLE: TableDefinition = {
  name: 'files',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'device_id', type: 'varchar(255)', nullable: false, key: 'MUL' },
    { name: 'file_path', type: 'text', nullable: false },
    { name: 'file_name', type: 'varchar(500)', nullable: false },
    { name: 'parent_path', type: 'text', nullable: true },
    { name: 'is_directory', type: 'tinyint(1)', nullable: true, default: '0' },
    { name: 'file_size', type: 'int', nullable: true, default: '0' },
    { name: 'content', type: 'longtext', nullable: true },
    { name: 'local_file_path', type: 'text', nullable: true },
    { name: 'file_type', type: "enum('text','binary','unknown')", nullable: true, default: "'unknown'" },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'idx_device_id', columns: ['device_id'], unique: false },
    { name: 'idx_file_name', columns: ['file_name'], unique: false },
    { name: 'idx_created_at', columns: ['created_at'], unique: false },
    { name: 'idx_local_file_path', columns: ['local_file_path'], unique: false },
    { name: 'idx_files_is_directory', columns: ['is_directory'], unique: false },
  ],
  foreignKeys: [
    { name: 'files_ibfk_1', column: 'device_id', referencedTable: 'devices', referencedColumn: 'device_id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  comment: 'Files table: metadata only. All file contents stored on disk via local_file_path'
}

export const CREDENTIALS_TABLE: TableDefinition = {
  name: 'credentials',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'device_id', type: 'varchar(255)', nullable: false, key: 'MUL' },
    { name: 'url', type: 'text', nullable: true },
    { name: 'domain', type: 'varchar(255)', nullable: true },
    { name: 'tld', type: 'varchar(50)', nullable: true },
    { name: 'username', type: 'varchar(500)', nullable: true },
    { name: 'password', type: 'text', nullable: true },
    { name: 'browser', type: 'varchar(255)', nullable: true },
    { name: 'file_path', type: 'text', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'idx_device_id', columns: ['device_id'], unique: false },
    { name: 'idx_domain', columns: ['domain'], unique: false },
    { name: 'idx_tld', columns: ['tld'], unique: false },
    { name: 'idx_username', columns: ['username'], unique: false },
    { name: 'idx_created_at', columns: ['created_at'], unique: false },
    { name: 'idx_credentials_browser_device', columns: ['browser', 'device_id'], unique: false },
    { name: 'idx_credentials_tld_device', columns: ['tld', 'device_id'], unique: false },
    { name: 'idx_credentials_domain_url_prefix', columns: ['domain', 'url'], unique: false },
  ],
  foreignKeys: [
    { name: 'credentials_ibfk_1', column: 'device_id', referencedTable: 'devices', referencedColumn: 'device_id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

export const PASSWORD_STATS_TABLE: TableDefinition = {
  name: 'password_stats',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'device_id', type: 'varchar(255)', nullable: false, key: 'MUL' },
    { name: 'password', type: 'text', nullable: false },
    { name: 'count', type: 'int', nullable: true, default: '1' },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'idx_device_id', columns: ['device_id'], unique: false },
    { name: 'idx_count', columns: ['count'], unique: false },
    { name: 'idx_password_stats_password_device', columns: ['password', 'device_id'], unique: false },
  ],
  foreignKeys: [
    { name: 'password_stats_ibfk_1', column: 'device_id', referencedTable: 'devices', referencedColumn: 'device_id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

export const ANALYTICS_CACHE_TABLE: TableDefinition = {
  name: 'analytics_cache',
  columns: [
    { name: 'id', type: 'int', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'cache_key', type: 'varchar(255)', nullable: false, key: 'UNI' },
    { name: 'cache_data', type: 'longtext', nullable: true },
    { name: 'expires_at', type: 'timestamp', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'cache_key', columns: ['cache_key'], unique: true },
    { name: 'idx_cache_key', columns: ['cache_key'], unique: false },
    { name: 'idx_expires_at', columns: ['expires_at'], unique: false },
  ],
  foreignKeys: [],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

export const SOFTWARE_TABLE: TableDefinition = {
  name: 'software',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'device_id', type: 'varchar(255)', nullable: false, key: 'MUL' },
    { name: 'software_name', type: 'varchar(500)', nullable: false },
    { name: 'version', type: 'varchar(500)', nullable: true },
    { name: 'source_file', type: 'varchar(255)', nullable: false },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'idx_device_id', columns: ['device_id'], unique: false },
    { name: 'idx_software_name', columns: ['software_name'], unique: false },
    { name: 'idx_version', columns: ['version'], unique: false },
    { name: 'idx_source_file', columns: ['source_file'], unique: false },
    { name: 'idx_created_at', columns: ['created_at'], unique: false },
    { name: 'idx_software_name_version_device', columns: ['software_name', 'version', 'device_id'], unique: false },
  ],
  foreignKeys: [
    { name: 'software_ibfk_1', column: 'device_id', referencedTable: 'devices', referencedColumn: 'device_id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

export const SYSTEMINFORMATION_TABLE: TableDefinition = {
  name: 'systeminformation',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'device_id', type: 'varchar(255)', nullable: false, key: 'UNI' },
    { name: 'stealer_type', type: 'varchar(100)', nullable: false, default: "'Generic'" },
    { name: 'os', type: 'varchar(500)', nullable: true },
    { name: 'ip_address', type: 'varchar(100)', nullable: true },
    { name: 'username', type: 'varchar(500)', nullable: true },
    { name: 'cpu', type: 'varchar(500)', nullable: true },
    { name: 'ram', type: 'varchar(100)', nullable: true },
    { name: 'computer_name', type: 'varchar(500)', nullable: true },
    { name: 'gpu', type: 'varchar(500)', nullable: true },
    { name: 'country', type: 'varchar(100)', nullable: true },
    { name: 'log_date', type: 'varchar(10)', nullable: true, comment: 'Normalized date in YYYY-MM-DD format' },
    { name: 'log_time', type: 'varchar(8)', nullable: false, default: "'00:00:00'", comment: 'Normalized time in HH:mm:ss format (always string, default 00:00:00)' },
    { name: 'hwid', type: 'varchar(255)', nullable: true },
    { name: 'file_path', type: 'text', nullable: true },
    { name: 'antivirus', type: 'varchar(500)', nullable: true },
    { name: 'source_file', type: 'varchar(255)', nullable: false },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP', extra: 'on update CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'device_id', columns: ['device_id'], unique: true },
    { name: 'idx_device_id', columns: ['device_id'], unique: false },
    { name: 'idx_stealer_type', columns: ['stealer_type'], unique: false },
    { name: 'idx_os', columns: ['os'], unique: false },
    { name: 'idx_ip_address', columns: ['ip_address'], unique: false },
    { name: 'idx_username', columns: ['username'], unique: false },
    { name: 'idx_country', columns: ['country'], unique: false },
    { name: 'idx_hwid', columns: ['hwid'], unique: false },
    { name: 'idx_source_file', columns: ['source_file'], unique: false },
    { name: 'idx_created_at', columns: ['created_at'], unique: false },
  ],
  foreignKeys: [
    { name: 'systeminformation_ibfk_1', column: 'device_id', referencedTable: 'devices', referencedColumn: 'device_id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

export const APP_SETTINGS_TABLE: TableDefinition = {
  name: 'app_settings',
  columns: [
    { name: 'id', type: 'int', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'key_name', type: 'varchar(255)', nullable: false, key: 'UNI' },
    { name: 'value', type: 'text', nullable: false },
    { name: 'description', type: 'text', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP', extra: 'on update CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'key_name', columns: ['key_name'], unique: true },
    { name: 'idx_key_name', columns: ['key_name'], unique: false },
  ],
  foreignKeys: [],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

export const USERS_TABLE: TableDefinition = {
  name: 'users',
  columns: [
    { name: 'id', type: 'int', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'email', type: 'varchar(255)', nullable: false, key: 'UNI' },
    { name: 'password_hash', type: 'varchar(255)', nullable: false },
    { name: 'name', type: 'varchar(255)', nullable: true },
    { name: 'role', type: "enum('admin','analyst')", nullable: false, default: "'admin'" },
    { name: 'is_active', type: 'tinyint(1)', nullable: false, default: '1' },
    { name: 'totp_secret', type: 'varchar(255)', nullable: true },
    { name: 'totp_enabled', type: 'tinyint(1)', nullable: true, default: '0' },
    { name: 'backup_codes', type: 'text', nullable: true },
    { name: 'preferences', type: 'text', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP', extra: 'on update CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'email', columns: ['email'], unique: true },
    { name: 'idx_email', columns: ['email'], unique: false },
    { name: 'idx_users_role', columns: ['role'], unique: false },
    { name: 'idx_users_is_active', columns: ['is_active'], unique: false },
    { name: 'idx_totp_enabled', columns: ['totp_enabled'], unique: false },
  ],
  foreignKeys: [],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

// API Keys Table - Store API keys for external access
export const API_KEYS_TABLE: TableDefinition = {
  name: 'api_keys',
  columns: [
    { name: 'id', type: 'int', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'user_id', type: 'int', nullable: false, key: 'MUL' },
    { name: 'key_prefix', type: 'varchar(10)', nullable: false, comment: 'First 10 chars for identification' },
    { name: 'key_hash', type: 'varchar(64)', nullable: false, key: 'UNI', comment: 'SHA-256 hash of full key' },
    { name: 'name', type: 'varchar(255)', nullable: false, comment: 'User-friendly name for the key' },
    { name: 'role', type: "enum('admin','analyst')", nullable: false, default: "'analyst'" },
    { name: 'rate_limit', type: 'int', nullable: false, default: '100', comment: 'Max requests per window' },
    { name: 'rate_limit_window', type: 'int', nullable: false, default: '60', comment: 'Window in seconds' },
    { name: 'is_active', type: 'tinyint(1)', nullable: false, default: '1' },
    { name: 'expires_at', type: 'timestamp', nullable: true },
    { name: 'last_used_at', type: 'timestamp', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP', extra: 'on update CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'key_hash', columns: ['key_hash'], unique: true },
    { name: 'idx_api_keys_user_id', columns: ['user_id'], unique: false },
    { name: 'idx_api_keys_is_active', columns: ['is_active'], unique: false },
    { name: 'idx_api_keys_expires_at', columns: ['expires_at'], unique: false },
    { name: 'idx_api_keys_role', columns: ['role'], unique: false },
  ],
  foreignKeys: [
    { name: 'api_keys_ibfk_1', column: 'user_id', referencedTable: 'users', referencedColumn: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

// API Request Logs Table - Audit trail for API requests
export const API_REQUEST_LOGS_TABLE: TableDefinition = {
  name: 'api_request_logs',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'api_key_id', type: 'int', nullable: false, key: 'MUL' },
    { name: 'endpoint', type: 'varchar(255)', nullable: false },
    { name: 'method', type: 'varchar(10)', nullable: false },
    { name: 'status_code', type: 'int', nullable: false },
    { name: 'request_size', type: 'int', nullable: true },
    { name: 'response_size', type: 'int', nullable: true },
    { name: 'duration_ms', type: 'int', nullable: true },
    { name: 'ip_address', type: 'varchar(45)', nullable: true },
    { name: 'user_agent', type: 'varchar(500)', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'idx_api_request_logs_api_key_id', columns: ['api_key_id'], unique: false },
    { name: 'idx_api_request_logs_endpoint', columns: ['endpoint'], unique: false },
    { name: 'idx_api_request_logs_created_at', columns: ['created_at'], unique: false },
    { name: 'idx_api_request_logs_status_code', columns: ['status_code'], unique: false },
  ],
  foreignKeys: [
    { name: 'api_request_logs_ibfk_1', column: 'api_key_id', referencedTable: 'api_keys', referencedColumn: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

// Upload Jobs Table - Track API upload jobs
export const UPLOAD_JOBS_TABLE: TableDefinition = {
  name: 'upload_jobs',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'job_id', type: 'varchar(50)', nullable: false, key: 'UNI', comment: 'Public job identifier' },
    { name: 'api_key_id', type: 'int', nullable: false, key: 'MUL' },
    { name: 'user_id', type: 'int', nullable: false, key: 'MUL' },
    { name: 'status', type: "enum('pending','processing','completed','failed','cancelled')", nullable: false, default: "'pending'" },
    { name: 'progress', type: 'int', nullable: false, default: '0', comment: 'Progress 0-100' },
    { name: 'original_filename', type: 'varchar(500)', nullable: true },
    { name: 'file_size', type: 'bigint', nullable: true },
    { name: 'file_path', type: 'text', nullable: true },
    { name: 'total_devices', type: 'int', nullable: false, default: '0' },
    { name: 'processed_devices', type: 'int', nullable: false, default: '0' },
    { name: 'total_credentials', type: 'int', nullable: false, default: '0' },
    { name: 'total_files', type: 'int', nullable: false, default: '0' },
    { name: 'error_message', type: 'text', nullable: true },
    { name: 'error_code', type: 'varchar(50)', nullable: true },
    { name: 'started_at', type: 'timestamp', nullable: true },
    { name: 'completed_at', type: 'timestamp', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP', extra: 'on update CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'job_id', columns: ['job_id'], unique: true },
    { name: 'idx_upload_jobs_api_key_id', columns: ['api_key_id'], unique: false },
    { name: 'idx_upload_jobs_user_id', columns: ['user_id'], unique: false },
    { name: 'idx_upload_jobs_status', columns: ['status'], unique: false },
    { name: 'idx_upload_jobs_created_at', columns: ['created_at'], unique: false },
  ],
  foreignKeys: [
    { name: 'upload_jobs_ibfk_1', column: 'api_key_id', referencedTable: 'api_keys', referencedColumn: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' },
    { name: 'upload_jobs_ibfk_2', column: 'user_id', referencedTable: 'users', referencedColumn: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

// Upload Job Logs Table - Detailed logs for upload jobs
export const UPLOAD_JOB_LOGS_TABLE: TableDefinition = {
  name: 'upload_job_logs',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'job_id', type: 'varchar(50)', nullable: false, key: 'MUL' },
    { name: 'log_level', type: "enum('debug','info','warning','error')", nullable: false, default: "'info'" },
    { name: 'message', type: 'text', nullable: false },
    { name: 'metadata', type: 'text', nullable: false },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'idx_upload_job_logs_job_id', columns: ['job_id'], unique: false },
    { name: 'idx_upload_job_logs_log_level', columns: ['log_level'], unique: false },
    { name: 'idx_upload_job_logs_created_at', columns: ['created_at'], unique: false },
  ],
  foreignKeys: [
    { name: 'upload_job_logs_ibfk_1', column: 'job_id', referencedTable: 'upload_jobs', referencedColumn: 'job_id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

// Audit Logs Table - Comprehensive audit trail for all user actions
export const AUDIT_LOGS_TABLE: TableDefinition = {
  name: 'audit_logs',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'user_id', type: 'int', nullable: true, comment: 'User who performed the action (NULL for system actions)' },
    { name: 'user_email', type: 'varchar(255)', nullable: true, comment: 'Email of user for display (denormalized for history)' },
    { name: 'action', type: 'varchar(50)', nullable: false, comment: 'Action type (e.g., user.create, upload.complete)' },
    { name: 'resource_type', type: 'varchar(50)', nullable: false, comment: 'Type of resource (user, api_key, settings, upload, device)' },
    { name: 'resource_id', type: 'varchar(255)', nullable: true, comment: 'ID of the affected resource' },
    { name: 'details', type: 'text', nullable: false, comment: 'JSON object with action details' },
    { name: 'ip_address', type: 'varchar(45)', nullable: true, comment: 'Client IP address' },
    { name: 'user_agent', type: 'varchar(500)', nullable: true, comment: 'Client user agent' },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'idx_audit_logs_user_id', columns: ['user_id'], unique: false },
    { name: 'idx_audit_logs_action', columns: ['action'], unique: false },
    { name: 'idx_audit_logs_resource_type', columns: ['resource_type'], unique: false },
    { name: 'idx_audit_logs_resource_id', columns: ['resource_id'], unique: false },
    { name: 'idx_audit_logs_created_at', columns: ['created_at'], unique: false },
    { name: 'idx_audit_logs_user_action', columns: ['user_id', 'action'], unique: false },
    { name: 'idx_audit_logs_resource', columns: ['resource_type', 'resource_id'], unique: false },
  ],
  foreignKeys: [],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

// Import Logs Table - Track all data import operations
export const IMPORT_LOGS_TABLE: TableDefinition = {
  name: 'import_logs',
  columns: [
    { name: 'id', type: 'bigint', nullable: false, extra: 'auto_increment', key: 'PRI' },
    { name: 'job_id', type: 'varchar(50)', nullable: false, key: 'UNI', comment: 'Unique job identifier' },
    { name: 'user_id', type: 'int', nullable: true, comment: 'User who initiated the import' },
    { name: 'user_email', type: 'varchar(255)', nullable: true, comment: 'Email of user for display (denormalized)' },
    { name: 'api_key_id', type: 'int', nullable: true, comment: 'API key used (if API import)' },
    { name: 'source', type: "enum('web','api')", nullable: false, default: "'web'", comment: 'Import source' },
    { name: 'filename', type: 'varchar(500)', nullable: true, comment: 'Original filename' },
    { name: 'file_size', type: 'bigint', nullable: true, comment: 'File size in bytes' },
    { name: 'status', type: "enum('pending','processing','completed','failed','cancelled')", nullable: false, default: "'pending'" },
    { name: 'total_devices', type: 'int', nullable: false, default: '0' },
    { name: 'processed_devices', type: 'int', nullable: false, default: '0' },
    { name: 'total_credentials', type: 'int', nullable: false, default: '0' },
    { name: 'total_files', type: 'int', nullable: false, default: '0' },
    { name: 'error_message', type: 'text', nullable: true, comment: 'Error message if failed' },
    { name: 'started_at', type: 'timestamp', nullable: true, comment: 'Processing start time' },
    { name: 'completed_at', type: 'timestamp', nullable: true, comment: 'Processing completion time' },
    { name: 'created_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: true, default: 'CURRENT_TIMESTAMP', extra: 'on update CURRENT_TIMESTAMP' },
  ],
  indexes: [
    { name: 'PRIMARY', columns: ['id'], unique: true },
    { name: 'job_id', columns: ['job_id'], unique: true },
    { name: 'idx_import_logs_user_id', columns: ['user_id'], unique: false },
    { name: 'idx_import_logs_api_key_id', columns: ['api_key_id'], unique: false },
    { name: 'idx_import_logs_source', columns: ['source'], unique: false },
    { name: 'idx_import_logs_status', columns: ['status'], unique: false },
    { name: 'idx_import_logs_created_at', columns: ['created_at'], unique: false },
    { name: 'idx_import_logs_user_source', columns: ['user_id', 'source'], unique: false },
  ],
  foreignKeys: [],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
}

// ===========================================
// ALL TABLES (in creation order - respect FK dependencies)
// ===========================================
export const ALL_TABLES: TableDefinition[] = [
  DEVICES_TABLE,
  FILES_TABLE,
  CREDENTIALS_TABLE,
  PASSWORD_STATS_TABLE,
  ANALYTICS_CACHE_TABLE,
  SOFTWARE_TABLE,
  SYSTEMINFORMATION_TABLE,
  APP_SETTINGS_TABLE,
  USERS_TABLE,
  API_KEYS_TABLE,
  API_REQUEST_LOGS_TABLE,
  UPLOAD_JOBS_TABLE,
  UPLOAD_JOB_LOGS_TABLE,
  AUDIT_LOGS_TABLE,
  IMPORT_LOGS_TABLE,
]

// ===========================================
// SCHEMA COMPARISON TYPES
// ===========================================

export interface SchemaDifference {
  type: 'missing_table' | 'extra_table' | 'missing_column' | 'extra_column' | 'column_type_mismatch' | 'column_nullable_mismatch' | 'column_default_mismatch' | 'missing_index' | 'extra_index' | 'missing_fk' | 'extra_fk'
  table: string
  detail: string
  expected?: string
  actual?: string
  severity: 'critical' | 'warning' | 'info'
  fixQuery?: string
}

export interface SchemaCheckResult {
  isValid: boolean
  schemaVersion: string
  differences: SchemaDifference[]
  missingTables: string[]
  extraTables: string[]
  summary: {
    totalTables: number
    validTables: number
    totalColumns: number
    validColumns: number
    totalIndexes: number
    validIndexes: number
    criticalIssues: number
    warnings: number
  }
}
