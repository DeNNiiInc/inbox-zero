#!/bin/bash
echo "Restarting application..."
pkill -f "next-server" || true
pkill -f "node.*server.js" || true
sleep 2
cd /var/www/inbox-zero/apps/web
export NODE_ENV=production
nohup /usr/bin/pnpm run start > /var/log/inbox-zero.log 2>&1 &
sleep 2
echo "Restart command issued."
echo "Check logs with: tail -f /var/log/inbox-zero.log"
