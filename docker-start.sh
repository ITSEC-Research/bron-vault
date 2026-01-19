#!/bin/bash

# =====================================================
# Bron Vault - Docker Start Script with Summary
# =====================================================
# Wrapper script for docker-compose up with summary
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ [ERROR] docker-compose not found!${NC}"
    echo ""
    echo "Make sure Docker is installed and running."
    echo ""
    echo "For Docker Desktop:"
    echo "  Download from: https://www.docker.com/products/docker-desktop"
    echo ""
    echo "For Linux (standalone):"
    echo "  Install docker-compose:"
    echo "    sudo apt-get update"
    echo "    sudo apt-get install docker.io docker-compose"
    echo ""
    exit 1
fi

echo -e "${CYAN}🚀 Starting Bron Vault Services...${NC}"
echo ""

# Ensure uploads directory exists with proper structure
echo -e "${BLUE}ℹ️  Ensuring uploads directory exists...${NC}"
mkdir -p ./uploads/chunks
mkdir -p ./uploads/extracted_files

# Get current user's UID and GID
# Note: UID is a readonly variable in bash, so we use HOST_UID and HOST_GID
# If running with sudo, get the original user's UID/GID instead of root (0)
if [ -n "$SUDO_USER" ]; then
  # Running with sudo, use the original user's UID/GID
  export HOST_UID=$(id -u "$SUDO_USER")
  export HOST_GID=$(id -g "$SUDO_USER")
  echo -e "${BLUE}ℹ️  Running with sudo, using original user's UID:GID ${HOST_UID}:${HOST_GID}${NC}"
else
  # Not running with sudo, use current user's UID/GID
  export HOST_UID=$(id -u)
  export HOST_GID=$(id -g)
  echo -e "${BLUE}ℹ️  Using UID:GID ${HOST_UID}:${HOST_GID} for container user${NC}"
fi

# Set proper permissions (rwx for owner and group, r-x for others)
# This ensures the container can write to the directories
chmod -R 775 ./uploads 2>/dev/null || true

# Note: chown might fail if running without sudo, but that's okay
# The important thing is that the container will run with matching UID/GID
chown -R ${HOST_UID}:${HOST_GID} ./uploads 2>/dev/null || {
  echo -e "${YELLOW}⚠️  Warning: Could not change ownership of ./uploads directory${NC}"
  echo -e "${YELLOW}   This is okay if you have proper permissions. Container will use UID:GID ${HOST_UID}:${HOST_GID}${NC}"
}

echo -e "${GREEN}✅ Uploads directory ready${NC}"
echo ""

# Always use --build but Docker will use cache for unchanged layers
# This ensures code updates are picked up while staying fast due to caching
# UID and GID are exported and will be used by docker-compose.yml
echo -e "${BLUE}ℹ️  Building with UID: ${HOST_UID}, GID: ${HOST_GID}${NC}"
echo -e "${BLUE}ℹ️  Building and starting services (using cache for unchanged layers)...${NC}"
docker-compose up -d --build

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""

# Wait a bit to ensure all services are ready
sleep 3

# Display status and URLs using separate script
echo ""
if [ -f "./docker-status.sh" ]; then
    ./docker-status.sh
else
    # Fallback if docker-status.sh doesn't exist
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}📊 Bron Vault Service Status${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    docker-compose ps
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📍 Access URLs:${NC}"
    echo ""
    echo -e "  🌐 ${YELLOW}Bron Vault App:${NC}    http://localhost:3000"
    echo -e "  📊 ${YELLOW}ClickHouse Play:${NC}     http://localhost:8123/play"
    echo -e "  🗄️  ${YELLOW}MySQL:${NC}              localhost:3306"
    echo -e "  📈 ${YELLOW}ClickHouse HTTP:${NC}      http://localhost:8123"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🔐 Default Login Credentials:${NC}"
    echo ""
    echo -e "  ${YELLOW}Email:${NC}    admin@bronvault.local"
    echo -e "  ${YELLOW}Password:${NC} admin"
    echo ""
    echo -e "  ${BLUE}ℹ️  Please change the password after first login for security.${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
fi

