#!/bin/sh
# Fix /app/uploads permissions so the app (nextjs) can write chunk and extracted files.
# The volume mount ./uploads:/app/uploads may be owned by root or another user;
# we ensure ownership and permissions at startup so uploads work without sudo on the host.
set -e
mkdir -p /app/uploads/chunks /app/uploads/extracted_files
chown -R nextjs:nodejs /app/uploads 2>/dev/null || true
chmod -R 775 /app/uploads 2>/dev/null || true
exec su nextjs -s /bin/sh -c "exec node server.js"
