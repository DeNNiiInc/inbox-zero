#!/bin/bash
set -e
cd /var/www/inbox-zero/apps/web

echo "Running migrations..."
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "Restarting app..."
pkill -f "next-server" || true
nohup ./node_modules/.bin/next start -p 3000 > /var/log/inbox-zero.log 2>&1 &
echo "Done."
