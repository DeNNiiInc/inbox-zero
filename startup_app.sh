#!/bin/bash
# Robust application startup script for Inbox Zero
# Usage: bash startup_app.sh

APP_DIR="/var/www/inbox-zero/apps/web"
LOG_FILE="/var/log/inbox-zero.log"

echo "[$(date)] Starting Inbox Zero startup sequence..."

# 1. Check Dependencies
echo "Checking Redis..."
if ! systemctl is-active --quiet redis-server; then
    echo "Redis is not running. Starting..."
    systemctl start redis-server
fi

echo "Checking PostgreSQL..."
if ! systemctl is-active --quiet postgresql; then
    echo "PostgreSQL is not running. Starting..."
    systemctl start postgresql
fi

# 2. Stop Existing Processes
echo "stopping existing user-space processes..."
pkill -f "next-server" || true
pkill -f "node.*server.js" || true

# 3. Source Environment
# Attempt to load nvm if installed for root/user
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 4. Start Application
echo "Starting application..."
cd "$APP_DIR" || { echo "Directory $APP_DIR not found"; exit 1; }

# Ensure we are on the production build
export NODE_ENV=production

# Start using valid npm/pnpm command found in path
if command -v pnpm &> /dev/null; then
    CMD="pnpm run start"
else
    CMD="npm run start"
fi

nohup $CMD > "$LOG_FILE" 2>&1 &
PID=$!

echo "Application started with PID $PID. Logs at $LOG_FILE"

# 5. Verify Startup
echo "Waiting for health check..."
sleep 10
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Application is responding on port 3000"
else
    echo "⚠️ Application may not be ready yet. Check logs:"
    tail -n 10 "$LOG_FILE"
fi
