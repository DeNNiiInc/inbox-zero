#!/bin/bash
set -e

APP_DIR="/var/www/inbox-zero/apps/web"

echo "Patching memory limit in package.json..."
sed -i 's/--max_old_space_size=16384/--max_old_space_size=4096/g' "$APP_DIR/package.json"

echo "Building application..."
cd "$APP_DIR"
pnpm build

echo "Build complete."
