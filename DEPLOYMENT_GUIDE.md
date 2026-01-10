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
| **Reference** | **OpenAI Models** | [OpenAI Model Documentation](https://platform.openai.com/docs/models?utm_source=chatgpt.com) |

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

# Install Redis (Optional - for debugging)
# apt install -y redis-tools

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

**Option A: Automated Generation** (Recommended)

If you have `secrets.php` configured locally, generate the `.env` file automatically:

```bash
# Generate and upload .env to server
bash generate_env.sh | ssh root@SERVER_IP 'cat > /var/www/inbox-zero/apps/web/.env'
```

**Option B: Manual Creation**

Create `/var/www/inbox-zero/apps/web/.env` manually:

```env
# Core
NEXT_PUBLIC_BASE_URL=https://inbox.beyondcloud.solutions
NODE_ENV=production

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/inboxzero?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/inboxzero?schema=public"

# Redis (Upstash)
UPSTASH_REDIS_URL="https://your-database.upstash.io"
UPSTASH_REDIS_TOKEN="your-upstash-token"

# AI Providers (2026 Configuration)
DEFAULT_LLM_PROVIDER="openai"
DEFAULT_LLM_MODEL="gpt-5.2"           # Flagship model (Outlook/Complex tasks)
CHAT_LLM_PROVIDER="openai"
CHAT_LLM_MODEL="gpt-5-mini"           # Economy model (Gmail/Simple tasks)
ECONOMY_LLM_PROVIDER="openai"
ECONOMY_LLM_MODEL="gpt-5-mini"        # Background tasks

OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-api03-..."  # Backup provider
OPENROUTER_API_KEY="sk-or-v1-..."     # Optional aggregator

# QStash (Background Jobs)
QSTASH_CURRENT_SIGNING_KEY="sig_..."
QSTASH_NEXT_SIGNING_KEY="sig_..."
QSTASH_URL="https://qstash.upstash.io"
QSTASH_TOKEN="eyJ..."

# Microsoft OAuth
MICROSOFT_CLIENT_ID="your-client-id"
MICROSOFT_CLIENT_SECRET="your-client-secret"
MICROSOFT_TENANT_ID="common"  # CRITICAL: Use "common" for multi-tenant support, NOT a specific tenant ID
MICROSOFT_WEBHOOK_CLIENT_STATE="your-webhook-secret"  # Generate with: openssl rand -hex 32

# Google OAuth (set to placeholder if not using Gmail)
GOOGLE_CLIENT_ID="placeholder"
GOOGLE_CLIENT_SECRET="placeholder"
GOOGLE_PUBSUB_TOPIC_NAME="projects/placeholder/topics/placeholder"
GOOGLE_PUBSUB_VERIFICATION_TOKEN="placeholder"

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

### 5.3 AI Provider Optimization (Automatic)

The system is configured to optimize AI model usage based on the email provider:

| Provider | Model | Description |
|----------|-------|-------------|
| **Gmail** | `gpt-5-mini` | Cost-effective model for high-volume email processing. |
| **Outlook / M365** | `gpt-5.2` | Premium model for complex enterprise tasks and reasoning. |

*This logic is handled in `apps/web/utils/ai/provider-optimization.ts`.*

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

## 8. Google OAuth Setup

> [!NOTE]
> This section is required if you want to support Gmail accounts.

### 8.1 Configure Consent Screen (Google Auth Platform)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **"APIs & Services"** > **"OAuth consent screen"**.
   - *Note: You may be redirected to "Google Auth Platform".*
3. In the left sidebar, click **"Branding"**:
   - **App Name**: Enter `Inbox Zero`.
   - **User Support Email**: Select your email.
   - Click **Save**.
4. In the left sidebar, click **"Audience"**:
   - Scroll down to "User type" and select **External**.
   - Click **Save**.
5. In the left sidebar, click **"Data Access"**:
   - This may be where you add scopes later, but for now, ensure Branding and Audience are saved.

### 8.2 Create OAuth Credentials
1. In the left sidebar, click **"Clients"** (or return to **"Credentials"** in the main menu).
2. Click **+ Create Client** (or **+ Create Credentials** > **OAuth client ID**).
3. **Application Type**: Select **Web application**.
   - *If you don't see this, ensure you are in the "OAuth client ID" creation flow.*
4. **Name**: `Inbox Zero Production`.
5. **Authorized JavaScript origins**:
   - `https://inbox.beyondcloud.solutions`
   - `http://localhost:3000` (for local dev)
6. **Authorized redirect URIs**:
   - `https://inbox.beyondcloud.solutions/api/auth/callback/google`
   - `https://inbox.beyondcloud.solutions/api/google/linking/callback`
   - `https://inbox.beyondcloud.solutions/api/google/calendar/callback`
   - *(Add localhost versions if developing locally)*
7. Click **Create** (or **Save**).
8. Copy the **Client ID** and **Client Secret** into your `.env` file.

### 8.3 Configure Scopes
1. In the left sidebar, click **"Data Access"**.
2. Click the **"Add or Remove Scopes"** button.
3. In the "Manually add scopes" section (you may need to scroll down or look for a manual entry box), paste these URLs one by one or as a list:
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
   - `https://www.googleapis.com/auth/contacts`
   - `https://www.googleapis.com/auth/calendar`
4. Click **Update** (or **Save**).

### 8.4 Enable APIs
Search for and enable these APIs in "Enabled APIs & services":
- **Gmail API**
- **Google People API**
- **Google Calendar API**

### 8.5 Configure Real-time Notifications (PubSub)
1. Search for "Pub/Sub" in Google Cloud Console.
2. **Create Topic**:
   - Click **Create Topic**.
   - Topic ID: `inbox-zero-production`.
   - **Important**: Uncheck "Add a default subscription".
   - Click **Create**.
3. Add `projects/YOUR_PROJECT_ID/topics/inbox-zero-production` to `GOOGLE_PUBSUB_TOPIC_NAME` in `.env`.
   - *(Replace YOUR_PROJECT_ID with your actual project ID shown in the console URL or dashboard)*
4. **Create Subscription**:
   - Click on the topic you just created (ID `inbox-zero-production`).
   - Scroll down or look for **Create Subscription**.
   - Subscription ID: `inbox-zero-sub`.
   - **Delivery Type**: Select **Push**.
   - **Endpoint URL**: `https://inbox.beyondcloud.solutions/api/google/webhook?token=YOUR_VERIFICATION_TOKEN`
     - *(Generate a random string for `YOUR_VERIFICATION_TOKEN`, e.g., `openssl rand -hex 16`, and save it as `GOOGLE_PUBSUB_VERIFICATION_TOKEN` in `.env`)*
   - Click **Create**.
5. **Permissions** (Critical for Gmail to send notifications):
   - Go back to the **Topic** page (`inbox-zero-production`).
   - select the topic checkbox and click **Show Info Panel** (top right corner icon "i") or "View Permissions".
   - Click **Add Principal**.
   - New Principal: `gmail-api-push@system.gserviceaccount.com`
   - Role: **Pub/Sub Publisher**.
   - Click **Save**.

---

## 9. Cron Job Setup (Required for Push Notifications)

> [!IMPORTANT]
> Gmail and Outlook watch subscriptions **expire after 7 days**. Without a cron job to renew them, push notifications for new emails will stop working.

### 9.1 Automated Setup

Run the setup script from your local WSL environment:

```bash
bash setup_cron_jobs.sh
```

This script:
1. Reads `CRON_SECRET` from `secrets.php`
2. Installs a cron job at `/etc/cron.d/inbox-zero`
3. Triggers an initial watch renewal

### 9.2 Manual Setup

If you prefer manual setup, SSH into your server and create:

```bash
cat > /etc/cron.d/inbox-zero << 'EOF'
# Gmail/Outlook watch renewal - runs every 6 hours
0 */6 * * * root curl -s -X POST "http://localhost:3000/api/watch/all" -H "Content-Type: application/json" -d '{"CRON_SECRET":"YOUR_CRON_SECRET_HERE"}' >> /var/log/inbox-zero-cron.log 2>&1
EOF

chmod 644 /etc/cron.d/inbox-zero
```

Replace `YOUR_CRON_SECRET_HERE` with your actual `CRON_SECRET` from `.env`.

### 9.3 Verify Cron Jobs

```bash
# Check cron job is installed
cat /etc/cron.d/inbox-zero

# Check cron execution logs
tail -f /var/log/inbox-zero-cron.log

# Manually trigger watch renewal
curl -X POST "http://localhost:3000/api/watch/all" \
  -H "Content-Type: application/json" \
  -d '{"CRON_SECRET":"YOUR_CRON_SECRET"}'
```

---

## 10. Troubleshooting

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

### Multi-Tenant "Mailbox Inactive" Error

```
The mailbox is either inactive, soft-deleted, or is hosted on-premise.
```

**Cause:** `MICROSOFT_TENANT_ID` is set to a specific tenant ID instead of `"common"`.

**Solution:**
1. Update `.env` on the server:
   ```bash
   sed -i 's/MICROSOFT_TENANT_ID="[^"]*"/MICROSOFT_TENANT_ID="common"/' /var/www/inbox-zero/apps/web/.env
   ```
2. Clear the user's OAuth tokens in the database:
   ```sql
   UPDATE "Account" SET access_token = NULL, refresh_token = NULL
   WHERE id = (SELECT "accountId" FROM "EmailAccount" WHERE email = 'user@external-tenant.com');
   ```
3. Restart the application
4. Have the user sign out and sign back in

### Multi-Tenant Admin Consent

For external tenants to use the app, an admin must grant consent:

```
https://login.microsoftonline.com/{tenant-domain}/adminconsent?client_id={your-client-id}
```

Replace `{tenant-domain}` with the external tenant's domain (e.g., `contoso.com`).

### AI "Unexpected Error"

Check logs for missing API keys:
```bash
tail -f /var/log/inbox-zero.log | grep -i "api key"
```

Ensure `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are set in `.env`.

### Google "Access blocked: App has not completed verification"

```
Error 403: access_denied
The app is currently being tested, and can only be accessed by developer-approved testers.
```

**Cause:** The Google Cloud Project is in **"Testing"** mode (default) and your email is not in the "Test users" list.

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/) > **Audience**.
2. Scroll to **"Test users"**.
3. Click **+ Add users** and enter your email address (e.g., `dennii.inc@gmail.com`).
4. Save and try logging in again.

### Google "Redirect URI mismatch" (Error 400)

```
Error 400: redirect_uri_mismatch
```

**Cause:** The application URL may contain a trailing slash (e.g., `.solutions/`), causing Google to see a double slash `//` in the callback URL.

**Solution:**
Add the "double slash" URI to **Authorized redirect URIs** in Google Cloud Console:
`https://inbox.beyondcloud.solutions//api/google/calendar/callback`
*(Note the `//` in the path)*


---

## 11. Maintenance Commands

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
| `secrets.php` | All credentials - source of truth (gitignored) |
| `secrets.sample.php` | Template for secrets.php with all required fields |
| `remote_env_file` | Template for server .env file |
| `generate_env.sh` | Generates .env from secrets.php for automated setup |
| `setup_cron_jobs.sh` | Installs cron jobs for watch renewal on server |
| `redeploy_ai_agent.sh` | **Master deployment script** - parses secrets.php, builds, uploads, deploys |
| `local_build_fast.sh` | Local build wrapper (copies to native filesystem for speed) |
| `local_build.sh` | Core build logic (installs deps, builds Next.js, packages artifact) |
| `deploy_build.sh` | Remote deployment script (extracts artifact, restarts app) |
| `/root/restart_app.sh` | Application restart script (on server) |
| `/var/log/inbox-zero.log` | Application logs (on server) |
| `.agent/workflows/deploy-inbox-zero.md` | AI agent deployment workflow |
