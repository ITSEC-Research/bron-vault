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

# Check if containers already exist
if docker-compose ps -q | grep -q .; then
    # Containers exist, just start them (no build needed)
    echo -e "${BLUE}ℹ️  Containers already exist, starting without rebuild...${NC}"
    docker-compose up -d
else
    # First time setup, need to build
    echo -e "${BLUE}ℹ️  First time setup, building images...${NC}"
    docker-compose up -d --build
fi

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

