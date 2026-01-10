#!/bin/bash
# Check and start the Inbox Zero application

echo "=== System Status ==="
uptime

echo ""
echo "=== Checking Node processes ==="
pgrep -a node || echo "No node processes running"

echo ""
echo "=== Checking PostgreSQL ==="
systemctl status postgresql --no-pager | head -5 || service postgresql status

echo ""
echo "=== Checking Redis ==="
systemctl status redis --no-pager | head -5 || redis-cli ping

echo ""
echo "=== Starting the application ==="
cd /var/www/inbox-zero/apps/web

# Source nvm if available
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start the app
echo "Starting Next.js application..."
nohup npm run start > /var/log/inbox-zero.log 2>&1 &

sleep 8

echo ""
echo "=== Checking if app started ==="
pgrep -a node | head -5

echo ""
echo "=== Testing localhost:3000 ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 2>/dev/null || echo "App not responding yet"

echo ""
echo "=== Recent app logs ==="
tail -20 /var/log/inbox-zero.log 2>/dev/null || echo "No logs available"
