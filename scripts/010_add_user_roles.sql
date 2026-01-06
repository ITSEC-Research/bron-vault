-- =====================================================
-- Migration: Add User Roles
-- =====================================================
-- This migration adds role-based access control to the users table.
-- 
-- Roles:
-- - 'admin': Full access (can upload data, manage settings)
-- - 'analyst': Read-only access (can view/search data, cannot upload)
--
-- BACKWARDS COMPATIBLE:
-- - All existing users will be assigned 'admin' role by default
-- - No data loss or schema conflicts
-- - Existing JWT tokens without role field will fallback to 'admin'
--
-- To run manually:
--   mysql -u root -p bronvault < scripts/010_add_user_roles.sql
--
-- Or via Docker:
--   docker exec -i bronvault-mysql mysql -u root -p$MYSQL_ROOT_PASSWORD bronvault < scripts/010_add_user_roles.sql
-- =====================================================

-- Check if column already exists before adding (prevents errors on re-run)
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'role'
);

SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE users ADD COLUMN role ENUM(''admin'', ''analyst'') NOT NULL DEFAULT ''admin'' AFTER name',
    'SELECT ''Column role already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index for role queries (if not exists)
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND INDEX_NAME = 'idx_users_role'
);

SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_users_role ON users(role)',
    'SELECT ''Index idx_users_role already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the migration
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'role';

-- Show current users with their roles
SELECT id, email, name, role FROM users;
