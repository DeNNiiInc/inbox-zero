#!/bin/bash
set -e

# Ensure we are in the project root
echo "Starting local build procedure..."

# 1. Setup Node 22 (Local user space)
if [ ! -d "node-v22.12.0-linux-x64" ]; then
    echo "Downloading Node.js v22..."
    curl -fO https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz
    tar -xf node-v22.12.0-linux-x64.tar.xz
fi

# Add to PATH
export PATH="$(pwd)/node-v22.12.0-linux-x64/bin:$PATH"
echo "Using Node: $(node -v)"

# 2. Install pnpm standalone
echo "Installing pnpm standalone..."
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
if ! command -v pnpm &> /dev/null; then
    wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -
fi
# Re-source or ensure path
export PATH="$PNPM_HOME:$PATH"
echo "pnpm version: $(pnpm -v)"

# 3. Install Dependencies (Root)
# We need to install root deps first for monorepo linking to work
echo "Installing root dependencies..."
pnpm install

# 4. Generate Database Client
echo "Generating Prisma Client..."
# We need environment variables for this? 
# apps/web/.env should have been copied.
cd apps/web
pnpm prisma generate

# 4.5 Patch package.json to skip migration during build
echo "Patching package.json to skip DB migration..."
sed -i 's/prisma migrate deploy && //g' package.json

# 5. Build
echo "Building application..."
# We need to ensure we don't have memory issues locally either.
pnpm build

# 6. Package
echo "Packaging artifacts..."
if [ -d ".next/standalone" ]; then
    echo "Standalone build detected. Packaging standalone..."
    cp -r public .next/standalone/apps/web/ || true
    cp -r .next/static .next/standalone/apps/web/.next/ || true
    cd ../..
    tar -czf deployment.tar.gz -C apps/web/.next/standalone .
else
    echo "Standard build detected. Packaging .next + node_modules..."
    tar -czf ../../deployment.tar.gz .next public package.json node_modules
    cd ../..
fi

echo "Build and Package Complete: deployment.tar.gz"
