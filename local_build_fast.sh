#!/bin/bash
set -e
ORIG_DIR=$(pwd)
BUILD_DIR="$HOME/inbox-zero-build"

echo "Optimizing build by moving to native filesystem: $BUILD_DIR"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "Copying source..."
rsync -a --exclude 'node_modules' --exclude 'apps/web/node_modules' --exclude '.next' --exclude 'apps/web/.next' --exclude '.git' . "$BUILD_DIR/"

echo "Starting build in $BUILD_DIR..."
cd "$BUILD_DIR"
bash local_build.sh

echo "Copying artifact back..."
cp deployment.tar.gz "$ORIG_DIR/deployment.tar.gz"
echo "Done. Artifact: $ORIG_DIR/deployment.tar.gz"
