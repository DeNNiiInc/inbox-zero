#!/bin/bash
set -e
ORIG_DIR=$(pwd)
BUILD_DIR="$HOME/inbox-zero-build"

echo "Optimizing build by moving to native filesystem: $BUILD_DIR"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Extract git info before copying (while .git is available)
echo "Extracting git version info..."
GIT_COMMIT_SHORT=$(git log -1 --format="%h" | cut -c1-10)
GIT_COMMIT_DATE=$(git log -1 --format="%ci")
echo "NEXT_PUBLIC_GIT_COMMIT=$GIT_COMMIT_SHORT" >> apps/web/.env
echo "NEXT_PUBLIC_GIT_DATE=$GIT_COMMIT_DATE" >> apps/web/.env
echo "Git version: $GIT_COMMIT_SHORT ($GIT_COMMIT_DATE)"

echo "Copying source..."
rsync -a --exclude 'node_modules' --exclude 'apps/web/node_modules' --exclude '.next' --exclude 'apps/web/.next' --exclude '.git' . "$BUILD_DIR/"

echo "Starting build in $BUILD_DIR..."
cd "$BUILD_DIR"
bash local_build.sh

echo "Copying artifact back..."
cp deployment.tar.gz "$ORIG_DIR/deployment.tar.gz"
echo "Done. Artifact: $ORIG_DIR/deployment.tar.gz"
