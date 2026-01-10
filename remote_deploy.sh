#!/bin/bash
set -e

APP_DIR="/var/www/inbox-zero/apps/web"
TAR_FILE="/root/deployment.tar.gz"

echo "Deploying to $APP_DIR..."

# Ensure directory exists but cleaning it might remove .env? 
# .env is crucial. We should back it up or ensure tar doesn't overwrite it (tar overwrites by default).
# The tarball does NOT contain .env (local build usually excludes it, we copied remote_env_file to .env locally but tar command was:
# tar -czf ../../deployment.tar.gz .next public package.json node_modules
# It does NOT include .env. Good.

if [ -f "$APP_DIR/.env" ]; then
    echo "Backing up .env..."
    cp "$APP_DIR/.env" "/root/.env.bak"
fi

# Extract
echo "Extracting artifact..."
mkdir -p "$APP_DIR"
tar -xzf "$TAR_FILE" -C "$APP_DIR"

# Restore .env just in case
if [ -f "/root/.env.bak" ]; then
    cp "/root/.env.bak" "$APP_DIR/.env"
fi

# Migrations
# We need to find the schema.
# In monorepo, it's usually in packages/database/prisma/schema.prisma
# The tarball does not contain packages/database.
# BUT the server has the cloned repo.
SCHEMA_PATH="/var/www/inbox-zero/packages/database/prisma/schema.prisma"

if [ -f "$SCHEMA_PATH" ]; then
    echo "Running migrations with schema: $SCHEMA_PATH"
    cd "$APP_DIR"
    # Use the local prisma binary
    ./node_modules/.bin/prisma migrate deploy --schema="$SCHEMA_PATH"
else
    echo "WARNING: Schema not found at $SCHEMA_PATH. Skipping migrations (hope they are applied or unnecessary)."
fi

# Start
echo "Starting application..."
cd "$APP_DIR"
# Kill existing
pkill -f "next-server" || true

# Start with nohup
nohup ./node_modules/.bin/next start -p 3000 > /var/log/inbox-zero.log 2>&1 &

echo "Deployment complete. App running on port 3000."
