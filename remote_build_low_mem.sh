#!/bin/bash
set -e

APP_DIR="/var/www/inbox-zero/apps/web"

echo "Stopping services to free up memory..."
systemctl stop postgresql
systemctl stop redis-server

echo "Patching memory limit in package.json to 3072MB..."
sed -i 's/--max_old_space_size=[0-9]*/--max_old_space_size=3072/g' "$APP_DIR/package.json"

echo "Building application..."
cd "$APP_DIR"
# database is down so migrate deploy might fail if it tries to connect?
# Wait, 'prisma migrate deploy' needs DB.
# We must keep DB up. Only stop Redis.
# Or restart DB just for migration, then stop?
# Actually Next.js build might static gen pages which needs DB.
# So we MUST keep DB up.
# We will only stop Redis.
systemctl start postgresql 
systemctl stop redis-server

pnpm build

echo "Restarting services..."
systemctl start redis-server
echo "Build complete."
