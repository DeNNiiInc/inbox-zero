#!/bin/bash
cd /var/www/inbox-zero/apps/web
echo "Restarting application..."
pkill -f "next-server" || true
nohup ./node_modules/.bin/next start -p 3000 > /var/log/inbox-zero.log 2>&1 &
echo "Restart command issued."
