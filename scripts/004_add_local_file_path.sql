-- Add local_file_path column to files table for binary file storage
ALTER TABLE files ADD COLUMN local_file_path TEXT NULL;

-- Add index for local file path queries
CREATE INDEX IF NOT EXISTS idx_local_file_path ON files(local_file_path);

-- Add comment for documentation
ALTER TABLE files COMMENT = 'Files table with support for both database content storage (text files) and local file path storage (binary files)';
