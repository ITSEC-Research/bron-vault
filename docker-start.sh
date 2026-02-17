#!/bin/bash

# =====================================================
# Bron Vault - Docker Start Script with Summary
# =====================================================
# Wrapper for: docker compose up -d --build
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# --- Docker & Compose v2 detection ---

# Ensure Docker binary exists
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker not detected.${NC}"
    echo ""

    if grep -qi ubuntu /etc/os-release 2>/dev/null; then
        echo -e "${BLUE}ℹ Ubuntu detected. Running install_docker.sh...${NC}"
        echo ""

        if [ -f "./install_docker.sh" ]; then
            chmod +x ./install_docker.sh
            ./install_docker.sh
        else
            echo -e "${RED}❌ install_docker.sh not found.${NC}"
            exit 1
        fi

        echo ""
        echo -e "${GREEN}✅ Docker installed.${NC}"
        echo -e "${YELLOW}⚠ Please logout and login again before running this script.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Docker not found and auto-install only supported on Ubuntu.${NC}"
        exit 1
    fi
fi

# Ensure Docker Compose v2 exists
if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker Compose v2 not detected.${NC}"
    echo ""
    echo "Please ensure docker-compose-plugin is installed."
    echo "On Ubuntu:"
    echo "  sudo apt install docker-compose-plugin"
    exit 1
fi

echo -e "${GREEN}✅ Docker Compose v2 detected.${NC}"
echo ""

# Check Docker daemon
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to Docker daemon.${NC}"
    echo ""
    echo "If you just installed Docker, logout/login first."
    echo "Or try:"
    echo "  sudo systemctl start docker"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Docker daemon is running.${NC}"
echo ""

# --- Start services ---

echo -e "${CYAN}🚀 Starting Bron Vault Services...${NC}"
echo ""

# Ensure uploads directory exists (container entrypoint will fix ownership at startup)
# Best practice: run without sudo; no host UID/GID matching needed
echo -e "${BLUE}ℹ️  Ensuring uploads directory exists...${NC}"
mkdir -p ./uploads/chunks
mkdir -p ./uploads/extracted_files
echo -e "${GREEN}✅ Uploads directory ready${NC}"
echo ""

echo -e "${BLUE}ℹ️  Building and starting services (using cache for unchanged layers)...${NC}"
docker compose up -d --build

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
    docker compose ps
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

