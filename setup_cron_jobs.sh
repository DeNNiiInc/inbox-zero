#!/bin/bash
# SETUP CRON JOBS FOR INBOX ZERO
# This script sets up necessary cron jobs on the production server.
# It reads CRON_SECRET from secrets.php and installs cron jobs.
#
# Usage (from WSL):
#   bash setup_cron_jobs.sh           # Installs cron jobs on remote server
#   bash setup_cron_jobs.sh --local   # Shows commands to run manually

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_FILE="$SCRIPT_DIR/secrets.php"

# ==========================================
# Parse credentials from secrets.php
# ==========================================
if [ ! -f "$SECRETS_FILE" ]; then
    echo "Error: secrets.php not found"
    exit 1
fi

SERVER_IP=$(php -r "include '$SECRETS_FILE'; echo \$secrets['ssh_host'];")
SERVER_USER=$(php -r "include '$SECRETS_FILE'; echo \$secrets['ssh_username'];")
SERVER_PASS=$(php -r "include '$SECRETS_FILE'; echo \$secrets['ssh_password'];")
CRON_SECRET=$(php -r "include '$SECRETS_FILE'; echo \$secrets['cron_secret'];")
PROJECT_URL=$(php -r "include '$SECRETS_FILE'; echo \$secrets['project_url'];")

if [ -z "$CRON_SECRET" ]; then
    echo "Error: cron_secret not found in secrets.php"
    exit 1
fi

# ==========================================
# Generate cron job content
# ==========================================
CRON_CONTENT="# Inbox Zero Cron Jobs
# Installed by setup_cron_jobs.sh on $(date '+%Y-%m-%d %H:%M:%S')

# Gmail/Outlook watch subscription renewal - runs every 6 hours
# Gmail watch expires after 7 days, so we renew frequently to ensure push works
0 */6 * * * root curl -s -X POST \"http://localhost:3000/api/watch/all\" -H \"Content-Type: application/json\" -d '{\"CRON_SECRET\":\"$CRON_SECRET\"}' >> /var/log/inbox-zero-cron.log 2>&1

# Outlook-specific watch renewal (optional, covered by above but runs separately for logging)
# 30 */6 * * * root curl -s -X POST \"http://localhost:3000/api/outlook/watch/all\" -H \"Content-Type: application/json\" -d '{\"CRON_SECRET\":\"$CRON_SECRET\"}' >> /var/log/inbox-zero-cron.log 2>&1
"

# ==========================================
# Install cron jobs
# ==========================================
if [ "$1" == "--local" ]; then
    echo "=== Manual Installation Instructions ==="
    echo ""
    echo "Create file: /etc/cron.d/inbox-zero"
    echo "With content:"
    echo "---"
    echo "$CRON_CONTENT"
    echo "---"
    echo ""
    echo "Or run this one-liner on the server:"
    echo "cat > /etc/cron.d/inbox-zero << 'EOF'"
    echo "$CRON_CONTENT"
    echo "EOF"
    exit 0
fi

echo "=== Installing Cron Jobs on $SERVER_IP ==="

# Check for sshpass
if ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass is not installed. Install with: sudo apt install sshpass"
    exit 1
fi

export SSHPASS="$SERVER_PASS"

# Create the cron file on the server
echo "[Step 1/3] Installing cron job..."
sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "cat > /etc/cron.d/inbox-zero << 'CRONEOF'
$CRON_CONTENT
CRONEOF"

# Set proper permissions
echo "[Step 2/3] Setting permissions..."
sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "chmod 644 /etc/cron.d/inbox-zero"

# Create log file with proper permissions
sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "touch /var/log/inbox-zero-cron.log && chmod 644 /var/log/inbox-zero-cron.log"

# Trigger initial watch renewal now
echo "[Step 3/3] Triggering initial watch renewal..."
RESULT=$(sshpass -e ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "curl -s -X POST 'http://localhost:3000/api/watch/all' -H 'Content-Type: application/json' -d '{\"CRON_SECRET\":\"$CRON_SECRET\"}'")

echo ""
echo "=== Cron Job Installation Complete ==="
echo ""
echo "Cron job installed at: /etc/cron.d/inbox-zero"
echo "Log file: /var/log/inbox-zero-cron.log"
echo ""
echo "Initial watch renewal result:"
echo "$RESULT"
echo ""
echo "To verify, run:"
echo "  ssh $SERVER_USER@$SERVER_IP 'cat /etc/cron.d/inbox-zero'"
