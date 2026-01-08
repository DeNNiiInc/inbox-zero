<?php
/**
 * Centralized Secrets Configuration - SAMPLE FILE
 *
 * Copy this file to secrets.php and fill in your actual credentials.
 * secrets.php is gitignored and should never be committed.
 *
 * Generate secrets with: openssl rand -hex 32
 */

global $secrets;
$secrets = [];

// ==========================================
// SSH SERVER CREDENTIALS
// ==========================================
$secrets['ssh_username'] = 'root';
$secrets['ssh_password'] = 'YOUR_SSH_PASSWORD';
$secrets['ssh_host']     = 'YOUR_SERVER_IP';

// ==========================================
// GITHUB INTEGRATION
// ==========================================
$secrets['github_username'] = 'your-email@example.com';
$secrets['github_token']    = 'ghp_YOUR_GITHUB_TOKEN';

// ==========================================
// PROJECT DEPLOYMENT
// ==========================================
$secrets['project_url'] = 'https://your-domain.com';

// ==========================================
// CLOUDFLARE TUNNEL
// ==========================================
// Token used for 'cloudflared service install <token>'
$secrets['cloudflare_tunnel_token'] = 'YOUR_CLOUDFLARE_TUNNEL_TOKEN';

// ==========================================
// AI & LLM PROVIDERS
// ==========================================
$anthropic_api_key = 'sk-ant-api03-YOUR_ANTHROPIC_KEY';
$openai_api_key = 'sk-proj-YOUR_OPENAI_KEY';
$openrouter_key = 'sk-or-v1-YOUR_OPENROUTER_KEY';

// ==========================================
// QSTASH (Background Jobs)
// ==========================================
$qstash_url = 'https://qstash.upstash.io';
$qstash_token = 'YOUR_QSTASH_TOKEN';
$qstash_current_signing_key = 'sig_YOUR_CURRENT_KEY';
$qstash_next_signing_key = 'sig_YOUR_NEXT_KEY';

// ==========================================
// WSL CREDENTIALS
// ==========================================
$secrets['wsl_user'] = 'root';
$secrets['wsl_pass'] = 'YOUR_WSL_PASSWORD';

// ==========================================
// MICROSOFT OAUTH
// ==========================================
$secrets['microsoft_client_id']     = 'YOUR_AZURE_CLIENT_ID';
$secrets['microsoft_client_secret'] = 'YOUR_AZURE_CLIENT_SECRET';
$secrets['microsoft_tenant_id']     = 'YOUR_AZURE_TENANT_ID';
$secrets['microsoft_webhook_client_state'] = 'YOUR_WEBHOOK_SECRET'; // Generate with: openssl rand -hex 32

// Microsoft OAuth Redirect URIs (add these in Azure Portal > App Registrations > Authentication)
// https://your-domain.com/api/auth/callback/microsoft
// https://your-domain.com/api/outlook/linking/callback
// https://your-domain.com/api/outlook/calendar/callback

/*
==========================================
DEPLOYMENT DOCUMENTATION
==========================================

SERVER DETAILS:
- Host: YOUR_SERVER_IP
- URL: https://your-domain.com
- App Path: /var/www/inbox-zero/apps/web

QUICK DEPLOYMENT STEPS:
1. Build locally: wsl bash local_build_fast.sh
2. Upload: wsl sshpass -e scp deployment.tar.gz root@SERVER_IP:/var/www/inbox-zero/
3. Deploy: wsl sshpass -e ssh root@SERVER_IP '/root/deploy_build.sh'
4. Verify: wsl sshpass -e ssh root@SERVER_IP 'tail -n 20 /var/log/inbox-zero.log'

REQUIRED SERVICES ON SERVER:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Cloudflared tunnel service

KEY FILES:
- remote_env_file: Template for server .env
- local_build_fast.sh: Local WSL build script
- deploy_build.sh: Remote deployment script (on server at /root/)
- restart_app.sh: Restart script (on server at /root/)

FULL DOCUMENTATION:
See DEPLOYMENT_GUIDE.md in project root for complete setup instructions.
*/
