#!/bin/bash

# =====================================================
# Bron Vault - Dockerized Setup Script
# =====================================================
# This script is designed to run INSIDE a Docker container
# Uses service names from docker compose (mysql, clickhouse)
# =====================================================

set -e

# Log Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  [SETUP]${NC} $1"; }
log_success() { echo -e "${GREEN}✅ [SETUP]${NC} $1"; }
log_error() { echo -e "${RED}❌ [SETUP]${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠️  [SETUP]${NC} $1"; }

# -----------------------------------------------------
# HOST CONFIGURATION
# (According to service names in docker compose project)
# -----------------------------------------------------

# For container-to-container connections, use SERVICE NAME
DB_HOST="mysql"           # Service name from docker compose
CH_HOST="clickhouse"      # Service name from docker compose

# For MaterializedMySQL, ClickHouse needs to connect to MySQL
# Using hostname set in docker compose (mysql_host)
# But we need to ensure ClickHouse can resolve this
MYSQL_HOSTNAME_FOR_CH="mysql_host"  # MySQL container hostname

log_info "Starting Setup Process inside Docker Container..."
log_info "MySQL Service: $DB_HOST"
log_info "ClickHouse Service: $CH_HOST"
log_info "MySQL Hostname (for ClickHouse): $MYSQL_HOSTNAME_FOR_CH"

# -----------------------------------------------------
# Validate Environment Variables
# -----------------------------------------------------

REQUIRED_VARS=(
    "MYSQL_ROOT_PASSWORD"
    "MYSQL_DATABASE"
    "MYSQL_USER"
    "MYSQL_PASSWORD"
    "CLICKHOUSE_USER"
    "CLICKHOUSE_PASSWORD"
    "CLICKHOUSE_DB"
    "SYNC_USER"
    "SYNC_PASSWORD"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    log_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    log_error "Please ensure .env file is properly configured and passed to container"
    exit 1
fi

log_success "All required environment variables are set"

# -----------------------------------------------------
# 1. Wait for MySQL
# -----------------------------------------------------

log_info "Waiting for MySQL to be ready..."

MAX_RETRIES=60
count=0
while [ $count -lt $MAX_RETRIES ]; do
    # Check connection directly to mysql service
    if mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1" >/dev/null 2>&1; then
        log_success "MySQL is ready!"
        break
    fi
    count=$((count + 1))
    if [ $((count % 5)) -eq 0 ]; then
        echo ""  # New line setiap 5 retry
    fi
    echo -n "."
    sleep 2
done

if [ $count -eq $MAX_RETRIES ]; then
    log_error "MySQL Connection Timeout after $MAX_RETRIES attempts"
    log_error "Please check MySQL container logs: docker compose logs mysql"
    exit 1
fi

# Verify MySQL is truly ready
log_info "Verifying MySQL connection..."
mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT VERSION();" >/dev/null 2>&1
log_success "MySQL connection verified"

# -----------------------------------------------------
# 2. Wait for ClickHouse
# -----------------------------------------------------

log_info "Waiting for ClickHouse to be ready..."

count=0
while [ $count -lt $MAX_RETRIES ]; do
    if curl -s "http://$CH_HOST:8123/ping" | grep -q "Ok"; then
        log_success "ClickHouse is ready!"
        break
    fi
    count=$((count + 1))
    if [ $((count % 5)) -eq 0 ]; then
        echo ""  # New line setiap 5 retry
    fi
    echo -n "."
    sleep 2
done

if [ $count -eq $MAX_RETRIES ]; then
    log_error "ClickHouse Connection Timeout after $MAX_RETRIES attempts"
    log_error "Please check ClickHouse container logs: docker compose logs clickhouse"
    exit 1
fi

# Verify ClickHouse is truly ready
log_info "Verifying ClickHouse connection..."
RESPONSE=$(curl -s -u "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" "http://$CH_HOST:8123/" -d "SELECT 1")
if echo "$RESPONSE" | grep -q "Exception"; then
    log_warning "ClickHouse responded but with error: $RESPONSE"
else
    log_success "ClickHouse connection verified"
fi

# -----------------------------------------------------
# 3. Create Replication User in MySQL
# -----------------------------------------------------

log_info "Creating MySQL Replication User ($SYNC_USER)..."

mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
-- Drop existing user if exists (for idempotency)
DROP USER IF EXISTS '${SYNC_USER}'@'%';
FLUSH PRIVILEGES;

-- Create replication user
CREATE USER '${SYNC_USER}'@'%' IDENTIFIED BY '${SYNC_PASSWORD}';

-- Grant necessary privileges for MaterializedMySQL
GRANT RELOAD ON *.* TO '${SYNC_USER}'@'%';
GRANT REPLICATION SLAVE ON *.* TO '${SYNC_USER}'@'%';
GRANT REPLICATION CLIENT ON *.* TO '${SYNC_USER}'@'%';
GRANT SELECT ON *.* TO '${SYNC_USER}'@'%';

FLUSH PRIVILEGES;

-- Verify user creation
SELECT User, Host FROM mysql.user WHERE User = '${SYNC_USER}';
EOF

if [ $? -eq 0 ]; then
    log_success "MySQL Replication user configured successfully"
else
    log_error "Failed to create MySQL replication user"
    exit 1
fi

# -----------------------------------------------------
# 4. Setup ClickHouse MaterializedMySQL
# -----------------------------------------------------

log_info "Enabling Experimental Feature on ClickHouse..."

RESPONSE=$(curl -s -u "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" -X POST "http://$CH_HOST:8123/" \
  -d "SET allow_experimental_database_materialized_mysql = 1")

if echo "$RESPONSE" | grep -q "Exception"; then
    log_warning "Feature might already be enabled or error occurred: $RESPONSE"
else
    log_success "MaterializedMySQL feature enabled"
fi

log_info "Resetting Analytics Database ($CLICKHOUSE_DB)..."

# Drop existing database if it exists (Clean Slate)
RESPONSE=$(curl -s -u "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" -X POST "http://$CH_HOST:8123/?allow_experimental_database_materialized_mysql=1" \
  -d "DROP DATABASE IF EXISTS ${CLICKHOUSE_DB}")

if echo "$RESPONSE" | grep -q "Exception"; then
    # Check if it's just "database doesn't exist" error (which is OK)
    if echo "$RESPONSE" | grep -qi "doesn't exist\|does not exist"; then
        log_info "Database doesn't exist yet (this is OK for first run)"
    else
        log_warning "Error dropping database (might not exist): $RESPONSE"
    fi
else
    log_success "Database cleanup completed"
fi

# Wait a bit for cleanup to complete
sleep 2

log_info "Creating MaterializedMySQL Database..."
log_info "  Source: ${MYSQL_HOSTNAME_FOR_CH}:3306/${MYSQL_DATABASE}"
log_info "  User: ${SYNC_USER}"

# Create new database that syncs to MySQL
# IMPORTANT: Using mysql_host (hostname) not mysql (service name)
# because ClickHouse needs to resolve the same hostname as set in MySQL container
RESPONSE=$(curl -s -u "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" -X POST "http://$CH_HOST:8123/?allow_experimental_database_materialized_mysql=1" \
  -d "CREATE DATABASE ${CLICKHOUSE_DB} ENGINE = MaterializedMySQL('${MYSQL_HOSTNAME_FOR_CH}:3306', '${MYSQL_DATABASE}', '${SYNC_USER}', '${SYNC_PASSWORD}')")

if echo "$RESPONSE" | grep -q "Exception"; then
    log_error "ClickHouse Setup Failed!"
    echo ""
    log_error "Error response: $RESPONSE"
    echo ""
    log_info "Troubleshooting steps:"
    echo "  1. Verify MySQL replication user exists:"
    echo "     docker compose exec mysql mysql -u root -p -e \"SELECT User, Host FROM mysql.user WHERE User = '${SYNC_USER}'\""
    echo ""
    echo "  2. Verify MySQL hostname is correct:"
    echo "     docker compose exec mysql hostname"
    echo ""
    echo "  3. Test connection from ClickHouse to MySQL:"
    echo "     docker compose exec clickhouse ping mysql_host"
    echo ""
    echo "  4. Check MySQL binlog configuration:"
    echo "     docker compose exec mysql mysql -u root -p -e \"SHOW VARIABLES LIKE 'log_bin'\""
    echo ""
    exit 1
else
    log_success "MaterializedMySQL Database Created Successfully!"
fi

# Verify database creation
log_info "Verifying database creation..."
sleep 3  # Give it a moment to initialize

RESPONSE=$(curl -s -u "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" -X POST "http://$CH_HOST:8123/" \
  -d "SHOW DATABASES")

if echo "$RESPONSE" | grep -q "${CLICKHOUSE_DB}"; then
    log_success "Database verification successful: ${CLICKHOUSE_DB} exists"
else
    log_warning "Database not found in list (might still be initializing)"
    log_info "This is normal - database might take a moment to appear"
    log_info "You can verify later with:"
    log_info "  curl -u ${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD} http://localhost:8123/ -d 'SHOW DATABASES'"
fi

# -----------------------------------------------------
# 5. Final Summary
# -----------------------------------------------------

echo ""
log_success "🎉 ALL SYSTEMS GO! Setup Completed."
echo ""
log_info "Summary:"
echo "  ✅ MySQL: Ready and configured"
echo "  ✅ MySQL Replication User: ${SYNC_USER} created"
echo "  ✅ ClickHouse: Ready and configured"
echo "  ✅ MaterializedMySQL Database: ${CLICKHOUSE_DB} created"
echo ""
log_info "Note: Initial data sync may take some time depending on database size."
log_info "You can monitor sync status by querying ClickHouse tables."
echo ""
