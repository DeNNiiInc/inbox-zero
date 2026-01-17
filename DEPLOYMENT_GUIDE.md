# Inbox Zero Self-Hosting Deployment Guide

**Last Updated:** 2026-01-17  
**Target Environment:** Ubuntu 22.04+ (Non-Docker)  
**Tested Server:** 172.16.69.227

---

## Quick Start (Existing Server)

If you already have the server set up and just need to redeploy:

```bash
# From your local machine (macOS/WSL)
bash redeploy_ai_agent.sh
```

This script reads `secrets.php`, builds locally, uploads, and deploys automatically.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Server Setup](#2-server-setup)
3. [Local Build Process](#3-local-build-process)
4. [Remote Deployment](#4-remote-deployment)
5. [Environment Configuration](#5-environment-configuration)
6. [Cloudflare Tunnel Setup](#6-cloudflare-tunnel-setup)
7. [Starting the Application](#7-starting-the-application)
8. [Google OAuth Setup](#8-google-oauth-setup)
9. [Cron Job Setup](#9-cron-job-setup)
10. [Troubleshooting](#10-troubleshooting)
10A. [Microsoft Azure AD Setup](#10a-microsoft-azure-ad-setup)
11. [Maintenance Commands](#11-maintenance-commands)
12. [Fresh Server Deployment Checklist](#12-fresh-server-deployment-checklist)

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

---

## 10A. Microsoft Azure AD Setup

> [!IMPORTANT]
> This section is **required** for Microsoft 365/Outlook support.

### 10A.1 Create App Registration

1. Go to [Azure Portal](https://portal.azure.com/) → **Azure Active Directory** → **App Registrations**
2. Click **+ New registration**
3. Configure:
   - **Name**: `Inbox Zero`
   - **Supported account types**: Select **Accounts in any organizational directory (Multitenant)** for multi-tenant support
   - **Redirect URI**: Leave blank for now (we'll add these later)
4. Click **Register**
5. Copy the **Application (client) ID** → `MICROSOFT_CLIENT_ID`

### 10A.2 Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **+ New client secret**
3. Set expiration (recommended: 24 months)
4. Copy the **Value** immediately → `MICROSOFT_CLIENT_SECRET`

### 10A.3 Configure Redirect URIs

Go to **Authentication** → **Add a platform** → **Web**:

Add these redirect URIs (replace `your-domain.com`):
```
https://your-domain.com/api/auth/callback/microsoft
https://your-domain.com/api/outlook/linking/callback
https://your-domain.com/api/outlook/calendar/callback
```

### 10A.4 Configure API Permissions

> [!CAUTION]
> The `User.ReadBasic.All` permission requires **Admin Consent** and is essential for shared mailbox display names.

Go to **API Permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**:

| Permission | Purpose |
|------------|---------|
| `openid` | OpenID Connect authentication |
| `profile` | Basic user profile |
| `email` | User email address |
| `User.Read` | Read signed-in user profile |
| `User.ReadBasic.All` | **Read shared mailbox display names** (requires admin consent) |
| `offline_access` | Refresh tokens for persistent access |
| `Mail.ReadWrite` | Read/write emails |
| `Mail.ReadWrite.Shared` | **Access shared mailboxes** |
| `Mail.Send` | Send emails (if enabled) |
| `Mail.Send.Shared` | **Send from shared mailboxes** (if enabled) |
| `Calendars.Read` | Read calendars |
| `Calendars.ReadWrite` | Read/write calendars |
| `Calendars.Read.Shared` | **Read shared mailbox calendars** |

After adding permissions, click **Grant admin consent for [Your Organization]**.

### 10A.5 Shared Mailbox Support

For the shared mailbox feature to work correctly:

1. **User.ReadBasic.All** - Required to fetch the shared mailbox's display name from the directory
2. **Mail.ReadWrite.Shared** - Required to access the shared mailbox's emails
3. **Calendars.Read.Shared** - Required to access the shared mailbox's calendar

The application uses these endpoints for shared mailboxes:
- Profile: `GET /users/{sharedMailboxEmail}` (requires `User.ReadBasic.All`)
- Calendars: `GET /users/{sharedMailboxEmail}/calendars` (requires `Calendars.Read.Shared`)
- Email: `GET /users/{sharedMailboxEmail}/messages` (requires `Mail.ReadWrite.Shared`)

---

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

---

## 12. Fresh Server Deployment Checklist

Use this checklist when deploying to a **brand new server**.

### Pre-Deployment (Local Machine)

- [ ] **Copy `secrets.sample.php` to `secrets.php`**
  ```bash
  cp secrets.sample.php secrets.php
  ```
- [ ] **Fill in all credentials in `secrets.php`**:
  - SSH credentials (`ssh_host`, `ssh_username`, `ssh_password`)
  - Database credentials (`db_user`, `db_password`)
  - AI API keys (`openai_api_key`, `anthropic_api_key`)
  - Microsoft OAuth (`microsoft_client_id`, `microsoft_client_secret`, `microsoft_tenant_id`)
  - Google OAuth (if using Gmail)
  - Security keys (generate with `openssl rand -hex 32`)
  - Upstash/QStash credentials
  - Project URL (`project_url`)

### Server Setup

1. **Install system dependencies**:
   ```bash
   apt update && apt upgrade -y
   curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
   apt install -y nodejs postgresql postgresql-contrib git openssl
   npm install -g pnpm
   ```

2. **Setup PostgreSQL**:
   ```bash
   sudo -u postgres psql <<EOF
   CREATE USER postgres WITH PASSWORD 'YOUR_DB_PASSWORD';
   CREATE DATABASE inboxzero OWNER postgres;
   GRANT ALL PRIVILEGES ON DATABASE inboxzero TO postgres;
   EOF
   ```

3. **Clone repository**:
   ```bash
   mkdir -p /var/www
   cd /var/www
   git clone https://github.com/DeNNiiInc/inbox-zero.git
   cd inbox-zero
   ```

4. **Install Cloudflare Tunnel**:
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared
   cloudflared service install YOUR_TUNNEL_TOKEN
   systemctl enable cloudflared
   systemctl start cloudflared
   ```

### OAuth Provider Setup

5. **Microsoft Azure AD** (for Outlook/M365):
   - Create App Registration in Azure Portal
   - Add redirect URIs (see [Section 10A](#10a-microsoft-azure-ad-setup))
   - Add API permissions including `User.ReadBasic.All`, `Mail.ReadWrite.Shared`
   - Grant admin consent
   - Copy Client ID and Secret to `secrets.php`

6. **Google OAuth** (for Gmail - optional):
   - Create OAuth Client in Google Cloud Console
   - Add redirect URIs (see [Section 8](#8-google-oauth-setup))
   - Enable Gmail, Calendar, and People APIs
   - Configure Pub/Sub for real-time notifications
   - Copy Client ID and Secret to `secrets.php`

### Deployment

7. **Run automated deployment from local machine**:
   ```bash
   bash redeploy_ai_agent.sh
   ```

   This will:
   - Build the application locally
   - Upload the artifact to the server
   - Extract and configure the application
   - Run database migrations
   - Start the application

### Post-Deployment

8. **Setup cron jobs for email watch renewal**:
   ```bash
   bash setup_cron_jobs.sh
   ```

9. **Verify deployment**:
   ```bash
   # Check application is running
   ssh root@YOUR_SERVER 'pgrep -f next-server && echo "Running" || echo "Stopped"'
   
   # Check logs
   ssh root@YOUR_SERVER 'tail -50 /var/log/inbox-zero.log'
   
   # Test URL
   curl -I https://your-domain.com
   ```

10. **Test OAuth flows**:
    - Navigate to the application URL
    - Test Microsoft login
    - Test linking a shared mailbox
    - Test calendar connection

### Common Issues

| Issue | Solution |
|-------|----------|
| "Mailbox is inactive" error | Set `MICROSOFT_TENANT_ID=common` |
| Shared mailbox shows wrong name | Grant `User.ReadBasic.All` permission in Azure |
| Calendar connects to wrong account | Ensure `mailboxAddress` is passed in OAuth state |
| Real-time notifications not working | Verify cron job is running with `cat /etc/cron.d/inbox-zero` |

---

## Appendix: Deployment Script Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCAL MACHINE (macOS/WSL)                         │
│                                                                      │
│  secrets.php ─────────┐                                              │
│                       v                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │             redeploy_ai_agent.sh                             │    │
│  │                                                              │    │
│  │  1. Parse credentials from secrets.php                       │    │
│  │  2. Run local_build_fast.sh                                  │    │
│  │     └── copies to native FS, runs pnpm build                 │    │
│  │     └── creates deployment.tar.gz                            │    │
│  │  3. Upload deployment.tar.gz to server                       │    │
│  │  4. Upload deploy_build.sh to server                         │    │
│  │  5. Inject environment variables                             │    │
│  │  6. Execute deploy_build.sh remotely                         │    │
│  │  7. Verify deployment                                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────┐
│                    REMOTE SERVER                                     │
│                                                                      │
│  /var/www/inbox-zero/deployment.tar.gz                               │
│                       │                                              │
│                       v                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │             /root/deploy_build.sh                            │    │
│  │                                                              │    │
│  │  1. Stop running next-server process                         │    │
│  │  2. Backup .env file                                         │    │
│  │  3. Extract deployment.tar.gz to apps/web/                   │    │
│  │  4. Restore .env file                                        │    │
│  │  5. Run prisma db push                                       │    │
│  │  6. Start application with pnpm start                        │    │
│  │  7. Application runs and logs to /var/log/inbox-zero.log     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```
