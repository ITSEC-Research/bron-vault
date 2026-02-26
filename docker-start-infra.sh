#!/bin/bash

# =====================================================
# Bron Vault - Start Infrastructure Only (for local dev)
# =====================================================
# Starts MySQL, ClickHouse, MinIO, and setup worker.
# Run the Next.js app locally with: npm run dev
# so that code changes are reflected immediately (hot reload).
# =====================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

if ! command -v docker &> /dev/null; then
    echo "Docker not found. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "Docker Compose v2 not detected. Please install docker-compose-plugin."
    exit 1
fi

echo -e "${CYAN}Starting infrastructure only (MySQL, ClickHouse, MinIO, setup)...${NC}"
echo ""

mkdir -p ./uploads/chunks ./uploads/extracted_files

docker compose up -d mysql clickhouse minio setup

echo ""
echo -e "${GREEN}Infrastructure is up.${NC}"
echo ""
echo -e "${BLUE}Next steps for hot-reload development:${NC}"
echo "  1. Copy env.local.example to .env.local (if not done yet)"
echo "  2. Set in .env.local: MYSQL_HOST=127.0.0.1, CLICKHOUSE_HOST=http://127.0.0.1:8123, DATABASE_URL=mysql://user:pass@127.0.0.1:3306/dbname"
echo "  3. npm install  (if not already done)"
echo "  4. Run: ${YELLOW}npm run dev${NC}"
echo ""
echo -e "  App: http://localhost:3000  |  MySQL: 127.0.0.1:3306  |  ClickHouse: http://127.0.0.1:8123  |  MinIO: http://localhost:9002"
echo ""
