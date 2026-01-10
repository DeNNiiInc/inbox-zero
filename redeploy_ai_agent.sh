#!/bin/bash
# REDEPLOY AI AGENT SCRIPT
# This script is designed for an AI agent to completely redeploy the application.
# It reads ALL credentials from secrets.php - no hardcoded credentials.
#
# Prerequisites:
# 1. secrets.php must exist with all required credentials
# 2. WSL environment with php, sshpass, pnpm installed
# 3. local_build_fast.sh and local_build.sh must be present

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_FILE="$SCRIPT_DIR/secrets.php"
PROJECT_PATH="/var/www/inbox-zero"

echo "=== STARTING AI AGENT REDEPLOYMENT ==="

# ==========================================
# 1. Parse Credentials from secrets.php
# ==========================================
if [ ! -f "$SECRETS_FILE" ]; then
    echo "Error: secrets.php not found at $SECRETS_FILE"
    echo "Please copy secrets.sample.php to secrets.php and fill in your credentials."
    exit 1
fi

echo "[Setup] Parsing credentials from secrets.php..."

# Extract credentials using PHP
SERVER_IP=$(php -r "include '$SECRETS_FILE'; echo \$secrets['ssh_host'];")
SERVER_USER=$(php -r "include '$SECRETS_FILE'; echo \$secrets['ssh_username'];")
SERVER_PASS=$(php -r "include '$SECRETS_FILE'; echo \$secrets['ssh_password'];")

if [ -z "$SERVER_IP" ] || [ -z "$SERVER_USER" ] || [ -z "$SERVER_PASS" ]; then
    echo "Error: Could not parse SSH credentials from secrets.php"
    echo "Ensure ssh_host, ssh_username, and ssh_password are set."
    exit 1
fi

echo "Target: $SERVER_USER@$SERVER_IP"

# ==========================================
# 2. Verification of Tools
# ==========================================
echo "[Setup] Verifying required tools..."

if ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass is not installed. Install with: sudo apt install sshpass"
    exit 1
fi

if ! command -v php &> /dev/null; then
    echo "Error: php is not installed. Install with: sudo apt install php"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "Warning: pnpm not in PATH. Will attempt to use local install."
fi

# ==========================================
# 3. Verify Required Scripts
# ==========================================
if [ ! -f "$SCRIPT_DIR/local_build_fast.sh" ]; then
    echo "Error: local_build_fast.sh not found."
    exit 1
fi

if [ ! -f "$SCRIPT_DIR/local_build.sh" ]; then
    echo "Error: local_build.sh not found."
    exit 1
fi

# ==========================================
# 4. Build Locally
# ==========================================
echo ""
echo "[Step 1/4] Building locally..."
cd "$SCRIPT_DIR"
bash local_build_fast.sh
if [ $? -ne 0 ]; then
    echo "Build failed."
    exit 1
fi

if [ ! -f "$SCRIPT_DIR/deployment.tar.gz" ]; then
    echo "Error: deployment.tar.gz was not created."
    exit 1
fi

echo "Build artifact created: $(ls -lh $SCRIPT_DIR/deployment.tar.gz | awk '{print $5}')"

# ==========================================
# 5. Upload Artifact
# ==========================================
echo ""
echo "[Step 2/4] Uploading artifact to $SERVER_IP..."
export SSHPASS="$SERVER_PASS"
sshpass -e scp -o StrictHostKeyChecking=no "$SCRIPT_DIR/deployment.tar.gz" "$SERVER_USER@$SERVER_IP:$PROJECT_PATH/"
if [ $? -ne 0 ]; then
    echo "Upload failed."
    exit 1
fi

echo "[Step 2b/4] Uploading deployment script..."
sshpass -e scp -o StrictHostKeyChecking=no "$SCRIPT_DIR/deploy_build.sh" "$SERVER_USER@$SERVER_IP:/root/deploy_build.sh"
sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "chmod +x /root/deploy_build.sh"
echo "Upload complete."

# ==========================================
# 6. Execute Remote Deploy
# ==========================================
echo ""
echo "[Step 3/4] Executing remote deployment..."
# Inject Upstash Credentials (if present in secrets.php)
UPSTASH_URL=$(php -r "include '$SECRETS_FILE'; echo \$secrets['upstash_redis_url'] ?? '';")
UPSTASH_TOKEN=$(php -r "include '$SECRETS_FILE'; echo \$secrets['upstash_redis_token'] ?? '';")

if [ ! -z "$UPSTASH_URL" ]; then
    echo "[Step 3a/4] Injecting Upstash credentials..."
    sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "cd $PROJECT_PATH/apps/web && touch .env && sed -i '/UPSTASH_REDIS_URL/d' .env && sed -i '/UPSTASH_REDIS_TOKEN/d' .env && echo 'UPSTASH_REDIS_URL=\"$UPSTASH_URL\"' >> .env && echo 'UPSTASH_REDIS_TOKEN=\"$UPSTASH_TOKEN\"' >> .env"
fi

sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "bash /root/deploy_build.sh"
if [ $? -ne 0 ]; then
    echo "Remote deployment failed."
    exit 1
fi

# ==========================================
# 7. Verify Status
# ==========================================
echo ""
echo "[Step 4/4] Verifying deployment..."
sleep 3

# Check if server is running
SERVER_STATUS=$(sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "pgrep -f 'next-server' > /dev/null && echo 'RUNNING' || echo 'STOPPED'")
if [ "$SERVER_STATUS" = "RUNNING" ]; then
    echo "✅ Server is running"
else
    echo "❌ Server is NOT running"
    echo "Check logs with: ssh $SERVER_USER@$SERVER_IP 'tail -50 /var/log/inbox-zero.log'"
    exit 1
fi

# Show last startup message
echo ""
echo "Last startup log:"
sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "grep -E '(Ready in|started server|error|Error)' /var/log/inbox-zero.log | tail -n 5"

echo ""
echo "=== REDEPLOYMENT COMPLETE ==="
echo "Application URL: $(php -r "include '$SECRETS_FILE'; echo \$secrets['project_url'];")"
