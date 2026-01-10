#!/bin/bash
set -e
cd /var/www/inbox-zero/apps/web
nohup pnpm start > /var/log/inbox-zero.log 2>&1 &
echo "Inbox Zero started in background. Logs: /var/log/inbox-zero.log"
