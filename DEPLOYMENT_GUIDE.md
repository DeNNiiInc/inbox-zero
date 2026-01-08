# Inbox Zero Self-Hosting Deployment Guide

**Last Updated:** 2026-01-08  
**Target Environment:** Ubuntu 22.04+ (Non-Docker)  
**Tested Server:** 172.16.69.227

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Server Setup](#2-server-setup)
3. [Local Build Process](#3-local-build-process)
4. [Remote Deployment](#4-remote-deployment)
5. [Environment Configuration](#5-environment-configuration)
6. [Cloudflare Tunnel Setup](#6-cloudflare-tunnel-setup)
7. [Starting the Application](#7-starting-the-application)
8. [Troubleshooting](#8-troubleshooting)
9. [Maintenance Commands](#9-maintenance-commands)

---

## 1. Prerequisites

### Required Accounts & Credentials

| Service | Purpose | Where to Get |
|---------|---------|--------------|
| Microsoft Azure AD | OAuth Login | [Azure Portal](https://portal.azure.com/) |
| OpenAI | AI Provider (Primary) | [OpenAI Platform](https://platform.openai.com/) |
| Anthropic | AI Provider (Backup) | [Anthropic Console](https://console.anthropic.com/) |
| Upstash QStash | Background Jobs | [Upstash Console](https://console.upstash.com/) |
| Cloudflare | Tunnel/DNS | [Cloudflare Dashboard](https://dash.cloudflare.com/) |

### Local Development Requirements

- **Windows with WSL2** (Ubuntu)
- **Node.js v22+** in WSL
- **pnpm** package manager
- **sshpass** for automated SSH

---

## 2. Server Setup

### 2.1 Install Dependencies

SSH into your server and run:

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js v22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Redis
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# Install other dependencies
apt install -y git openssl
```

### 2.2 Setup PostgreSQL Database

```bash
sudo -u postgres psql << EOF
CREATE USER postgres WITH PASSWORD 'password';
CREATE DATABASE inboxzero OWNER postgres;
GRANT ALL PRIVILEGES ON DATABASE inboxzero TO postgres;
EOF
```

### 2.3 Clone Repository

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/DeNNiiInc/inbox-zero.git
cd inbox-zero
```

---

## 3. Local Build Process

> **Why local build?** The remote server may have memory constraints. Building locally and deploying the artifact is more reliable.

### 3.1 Build Script (`local_build_fast.sh`)

This script copies the project to native WSL filesystem for faster builds:

```bash
#!/bin/bash
BUILD_DIR="/home/$(whoami)/inbox-zero-build"
echo "Optimizing build by moving to native filesystem: $BUILD_DIR"

# Copy source
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
rsync -a --exclude='node_modules' --exclude='.next' --exclude='deployment.tar.gz' ./ "$BUILD_DIR/"

cd "$BUILD_DIR"
echo "Starting build..."

# Install pnpm if needed
if ! command -v pnpm &> /dev/null; then
    curl -fsSL https://get.pnpm.io/install.sh | sh -
fi

# Install dependencies
pnpm install

# Patch package.json to skip DB migration during local build
cd apps/web
sed -i 's/prisma migrate deploy && next build/next build/' package.json

# Build
pnpm run build

# Restore package.json
git checkout package.json

# Package artifact
echo "Packaging artifacts..."
tar -czf deployment.tar.gz .next node_modules prisma package.json

# Copy back to original location
cp deployment.tar.gz "$OLDPWD/"
echo "Build complete! Artifact: deployment.tar.gz"
```

### 3.2 Run the Build

From WSL in the project directory:

```bash
bash local_build_fast.sh
```

---

## 4. Remote Deployment

### 4.1 Upload Artifact

```bash
export SSHPASS='YOUR_SSH_PASSWORD'
sshpass -e scp deployment.tar.gz root@SERVER_IP:/var/www/inbox-zero/
```

### 4.2 Deploy Script (`deploy_build.sh`)

Create this on the remote server at `/root/deploy_build.sh`:

```bash
#!/bin/bash
set -e
echo "=== Deploying new build ==="
cd /var/www/inbox-zero

# Stop the application
pkill -f "next-server" || true
sleep 2

# Backup .env
cp apps/web/.env /tmp/.env.backup 2>/dev/null || true

# Remove old build
rm -rf apps/web/.next

# Extract new build
tar -xzf deployment.tar.gz -C apps/web

# Restore .env
cp /tmp/.env.backup apps/web/.env 2>/dev/null || true

# Start application
cd apps/web
export NODE_ENV=production
nohup /usr/bin/pnpm run start > /var/log/inbox-zero.log 2>&1 &
sleep 3
echo "=== Deployment complete ==="
```

### 4.3 Run Deployment

```bash
chmod +x /root/deploy_build.sh
/root/deploy_build.sh
```

---

## 5. Environment Configuration

### 5.1 Create `.env` File

Create `/var/www/inbox-zero/apps/web/.env`:

```env
# Core
NEXT_PUBLIC_BASE_URL=https://inbox.beyondcloud.solutions/
NODE_ENV=production

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/inboxzero?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/inboxzero?schema=public"

# Redis (Local - using ioredis fork)
REDIS_URL="redis://localhost:6379"

# AI Providers
OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-api03-..."
DEFAULT_LLM_PROVIDER="openai"
OPENROUTER_API_KEY="sk-or-v1-..."

# QStash (Background Jobs)
QSTASH_CURRENT_SIGNING_KEY="sig_..."
QSTASH_NEXT_SIGNING_KEY="sig_..."
QSTASH_URL="https://qstash.upstash.io"
QSTASH_TOKEN="eyJ..."

# Microsoft OAuth
MICROSOFT_CLIENT_ID="your-client-id"
MICROSOFT_CLIENT_SECRET="your-client-secret"
MICROSOFT_TENANT_ID="your-tenant-id"
MICROSOFT_WEBHOOK_CLIENT_STATE="your-webhook-secret"  # Generate with: openssl rand -hex 32

# Google (Placeholders if not using Google OAuth)
GOOGLE_CLIENT_ID="placeholder"
GOOGLE_CLIENT_SECRET="placeholder"
GOOGLE_PUBSUB_TOPIC_NAME="projects/placeholder/topics/placeholder"

# Security Keys (generate with: openssl rand -hex 32)
AUTH_SECRET="your-64-char-hex-string"
EMAIL_ENCRYPT_SECRET="your-64-char-hex-string"
EMAIL_ENCRYPT_SALT="your-32-char-hex-string"
INTERNAL_API_KEY="your-64-char-hex-string"
API_KEY_SALT="your-64-char-hex-string"
CRON_SECRET="your-64-char-hex-string"

# Feature Flags
NEXT_PUBLIC_BYPASS_PREMIUM_CHECKS=true
LOG_ZOD_ERRORS=true
```

### 5.2 Run Database Migrations

```bash
cd /var/www/inbox-zero/apps/web
npx prisma migrate deploy
```

---

## 6. Cloudflare Tunnel Setup

### 6.1 Install Cloudflared

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### 6.2 Configure Tunnel

From Cloudflare Dashboard > Zero Trust > Tunnels, create a tunnel and get the token.

```bash
cloudflared service install YOUR_TUNNEL_TOKEN
systemctl enable cloudflared
systemctl start cloudflared
```

### 6.3 Configure Tunnel Routing

In Cloudflare Dashboard, add a public hostname:
- **Subdomain:** inbox
- **Domain:** beyondcloud.solutions
- **Service:** http://localhost:3000

---

## 7. Starting the Application

### 7.1 Manual Start

```bash
cd /var/www/inbox-zero/apps/web
NODE_ENV=production nohup pnpm run start > /var/log/inbox-zero.log 2>&1 &
```

### 7.2 Restart Script (`/root/restart_app.sh`)

```bash
#!/bin/bash
echo "Restarting application..."
pkill -f "next-server" || true
sleep 2
cd /var/www/inbox-zero/apps/web
NODE_ENV=production nohup /usr/bin/pnpm run start > /var/log/inbox-zero.log 2>&1 &
echo "Restart command issued."
```

---

## 8. Troubleshooting

### Redis Connection Errors

```
[Upstash Redis] Redis client was initialized without url or token
```

**Solution:** Ensure Redis is running:
```bash
systemctl start redis-server
systemctl enable redis-server
redis-cli ping  # Should return PONG
```

### Microsoft OAuth Redirect Mismatch

```
AADSTS50011: The redirect URI does not match
```

**Solution:** Add redirect URI in Azure Portal:
- Go to Azure AD > App Registrations > Your App > Authentication
- Add: `https://inbox.beyondcloud.solutions/api/auth/callback/microsoft`

### AI "Unexpected Error"

Check logs for missing API keys:
```bash
tail -f /var/log/inbox-zero.log | grep -i "api key"
```

Ensure `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are set in `.env`.

---

## 9. Maintenance Commands

### View Logs
```bash
tail -f /var/log/inbox-zero.log
```

### Check Application Status
```bash
pgrep -f "next-server" && echo "Running" || echo "Stopped"
```

### Restart Application
```bash
/root/restart_app.sh
```

### Update Application
1. Build locally: `bash local_build_fast.sh`
2. Upload: `scp deployment.tar.gz root@SERVER:/var/www/inbox-zero/`
3. Deploy: `ssh root@SERVER '/root/deploy_build.sh'`

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `secrets.php` | Local credential storage (gitignored) |
| `remote_env_file` | Template for server .env |
| `local_build_fast.sh` | Local build script |
| `deploy_build.sh` | Remote deployment script |
| `/root/restart_app.sh` | Application restart script |
| `/var/log/inbox-zero.log` | Application logs |
