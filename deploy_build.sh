#!/bin/bash
set -e
echo "=== Deploying new build ==="
cd /var/www/inbox-zero

# Stop the application
pkill -f "next-server" || true
pkill -f "node.*server.js" || true
sleep 2

# Backup current .env
cp apps/web/.env /tmp/.env.backup 2>/dev/null || true

# Remove old build artifacts
rm -rf apps/web/.next

# Extract new build
echo "Extracting deployment.tar.gz..."
tar -xzf deployment.tar.gz -C apps/web

# Restore .env
cp /tmp/.env.backup apps/web/.env 2>/dev/null || true

# Start the application using pnpm start
echo "Starting application..."
cd apps/web
export NODE_ENV=production
nohup /usr/bin/pnpm run start > /var/log/inbox-zero.log 2>&1 &
sleep 3
echo "=== Deployment complete ==="
