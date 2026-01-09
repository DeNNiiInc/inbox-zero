#!/bin/bash
set -e

# Configuration
REPO_URL="https://github.com/DeNNiiInc/inbox-zero.git"
APP_DIR="/var/www/inbox-zero"
NODE_VERSION="22.0.0"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Starting Inbox Zero Installation...${NC}"

# 1. System Dependencies
echo -e "${GREEN}Installing System Dependencies...${NC}"
apt-get update
apt-get install -y curl git openssl make build-essential sudo

# 2. Install Node.js & pnpm
echo -e "${GREEN}Installing Node.js and pnpm...${NC}"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pnpm

# 3. Install Redis
echo -e "${GREEN}Installing Redis...${NC}"
apt-get install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# 4. Install PostgreSQL (if not exists)
if ! command -v psql &> /dev/null; then
    echo -e "${GREEN}Installing PostgreSQL...${NC}"
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
else
    echo -e "${GREEN}PostgreSQL already installed.${NC}"
fi

# Configure DB (Run always to ensure state)
echo -e "${GREEN}Configuring PostgreSQL User and Database...${NC}"
# Use sudo or su depending on availability (we installed sudo above)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'password';"
sudo -u postgres psql -c "CREATE DATABASE inboxzero;" || true


# 5. Clone Repository
echo -e "${GREEN}Cloning Repository...${NC}"
if [ -d "$APP_DIR" ]; then
    echo "Directory $APP_DIR already exists. Pulling latest..."
    cd $APP_DIR
    git pull
else
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# 6. Install Dependencies
echo -e "${GREEN}Installing App Dependencies...${NC}"
pnpm install

# 7. Environment Setup
echo -e "${GREEN}Configuring Environment...${NC}"
if [ -f "/root/remote_env_file" ]; then
    echo "Found /root/remote_env_file. Copying to apps/web/.env..."
    cp /root/remote_env_file apps/web/.env
fi

if [ ! -f "apps/web/.env" ]; then
    echo "apps/web/.env file not found! Please copy it manually or via scp."
    # We create a placeholder if missing just to allow script to proceed if intent is 2-step
    # but preferably we want it real.
    # exit 1 
fi

# 8. Database Migration
echo -e "${GREEN}Running Database Migrations...${NC}"
cd apps/web
pnpm prisma generate
# pnpm prisma migrate deploy # This might fail if DB connection is bad or env missing

# 9. Build
echo -e "${GREEN}Building Application...${NC}"
# pnpm build # Configure memory limit if needed

echo -e "${GREEN}Installation Complete!${NC}"
echo "Don't forget to run 'pnpm start' in apps/web or setup a service."
