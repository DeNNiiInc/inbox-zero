<?php
/**
 * Centralized Secrets Configuration - SAMPLE FILE
 *
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to secrets.php: cp secrets.sample.php secrets.php
 * 2. Fill in ALL your actual credentials below
 * 3. secrets.php is gitignored and should NEVER be committed
 *
 * Generate secrets with: openssl rand -hex 32
 * Generate shorter secrets with: openssl rand -hex 16
 */

global $secrets;
$secrets = [];

// ==========================================
//  MAC OS SETUP INSTRUCTIONS
// ==========================================
// 1. Install Homebrew (Package Manager):
//    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
//
// 2. Install Required Tools for Deployment:
//    brew install php sshpass node pnpm
// ==========================================


// ==========================================
// SSH SERVER CREDENTIALS
// ==========================================
// Used by redeploy_ai_agent.sh for automated deployments
$secrets['ssh_username'] = 'root';
$secrets['ssh_password'] = 'YOUR_SSH_PASSWORD';
$secrets['ssh_host']     = 'YOUR_SERVER_IP';  // e.g., 172.16.69.227

// ==========================================
// PROJECT DEPLOYMENT
// ==========================================
$secrets['project_url'] = 'https://your-domain.com';  // e.g., https://inbox.beyondcloud.solutions

// ==========================================
// GITHUB INTEGRATION
// ==========================================
$secrets['github_username'] = 'your-email@example.com';
$secrets['github_token']    = 'ghp_YOUR_GITHUB_TOKEN';

// ==========================================
// WSL CREDENTIALS (for local builds)
// ==========================================
$secrets['wsl_user'] = 'root';
$secrets['wsl_pass'] = 'YOUR_WSL_PASSWORD';

// ==========================================
// DATABASE CREDENTIALS
// ==========================================
$secrets['db_host']     = 'localhost';
$secrets['db_port']     = '5432';
$secrets['db_name']     = 'inboxzero';
$secrets['db_user']     = 'postgres';
$secrets['db_password'] = 'YOUR_DB_PASSWORD';

// ==========================================
// REDIS CONFIGURATION
// ==========================================
$secrets['redis_url'] = 'redis://localhost:6379';

// ==========================================
// CLOUDFLARE TUNNEL
// ==========================================
// Token used for 'cloudflared service install <token>'
// Get from: Cloudflare Dashboard > Zero Trust > Tunnels
$secrets['cloudflare_tunnel_token'] = 'YOUR_CLOUDFLARE_TUNNEL_TOKEN';

// ==========================================
// AI & LLM PROVIDERS
// ==========================================
// OpenAI - Primary provider
// Get from: https://platform.openai.com/api-keys
$secrets['openai_api_key'] = 'sk-proj-YOUR_OPENAI_KEY';

// Anthropic - Backup provider
// Get from: https://console.anthropic.com/
$secrets['anthropic_api_key'] = 'sk-ant-api03-YOUR_ANTHROPIC_KEY';

// OpenRouter - Optional aggregator
// Get from: https://openrouter.ai/
$secrets['openrouter_api_key'] = 'sk-or-v1-YOUR_OPENROUTER_KEY';

// AI Model Configuration (2026 models)
// See: https://platform.openai.com/docs/models
$secrets['default_llm_provider'] = 'openai';
$secrets['default_llm_model']    = 'gpt-5.2';      // Flagship model for Outlook/complex tasks
$secrets['chat_llm_provider']    = 'openai';
$secrets['chat_llm_model']       = 'gpt-5-mini';   // Economy model for Gmail/simple tasks
$secrets['economy_llm_provider'] = 'openai';
$secrets['economy_llm_model']    = 'gpt-5-mini';   // Background tasks

// ==========================================
// REDIS (Upstash)
// ==========================================
$secrets['upstash_redis_url']   = 'https://example-12345.upstash.io';
$secrets['upstash_redis_token'] = 'your_upstash_token_here';

// ==========================================
// QSTASH (Background Jobs)
// ==========================================
// Get from: https://console.upstash.com/ > QStash
$secrets['qstash_url']                 = 'https://qstash.upstash.io';
$secrets['qstash_token']               = 'YOUR_QSTASH_TOKEN';
$secrets['qstash_current_signing_key'] = 'sig_YOUR_CURRENT_KEY';
$secrets['qstash_next_signing_key']    = 'sig_YOUR_NEXT_KEY';

// ==========================================
// MICROSOFT OAUTH (Azure AD)
// ==========================================
// Get from: Azure Portal > App Registrations
// IMPORTANT: Use "common" for tenant_id to support multi-tenant logins
$secrets['microsoft_client_id']           = 'YOUR_AZURE_CLIENT_ID';
$secrets['microsoft_client_secret']       = 'YOUR_AZURE_CLIENT_SECRET';
$secrets['microsoft_tenant_id']           = 'common';  // Use "common" for multi-tenant, NOT a specific tenant ID
$secrets['microsoft_webhook_client_state'] = 'YOUR_WEBHOOK_SECRET';  // Generate with: openssl rand -hex 32

// Required Redirect URIs (add these in Azure Portal > App Registrations > Authentication):
// - https://your-domain.com/api/auth/callback/microsoft
// - https://your-domain.com/api/outlook/linking/callback
// - https://your-domain.com/api/outlook/calendar/callback

// ==========================================
// GOOGLE OAUTH
// ==========================================
// Get from: Google Cloud Console > APIs & Services > Credentials
$secrets['google_client_id']     = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
$secrets['google_client_secret'] = 'YOUR_GOOGLE_CLIENT_SECRET';

// Google Pub/Sub for real-time notifications
// Format: projects/YOUR_PROJECT_ID/topics/inbox-zero-production
$secrets['google_pubsub_topic_name']        = 'projects/YOUR_PROJECT_ID/topics/inbox-zero-production';
$secrets['google_pubsub_verification_token'] = 'YOUR_PUBSUB_TOKEN';  // Generate with: openssl rand -hex 16

// Required Redirect URIs (add in Google Cloud Console > Credentials):
// - https://your-domain.com/api/auth/callback/google
// - https://your-domain.com/api/google/linking/callback
// - https://your-domain.com/api/google/calendar/callback

// ==========================================
// SECURITY KEYS
// ==========================================
// Generate each with: openssl rand -hex 32
$secrets['auth_secret']           = 'YOUR_64_CHAR_HEX_STRING';  // NextAuth secret
$secrets['email_encrypt_secret']  = 'YOUR_64_CHAR_HEX_STRING';  // Email encryption key
$secrets['email_encrypt_salt']    = 'YOUR_32_CHAR_HEX_STRING';  // Shorter: openssl rand -hex 16
$secrets['internal_api_key']      = 'YOUR_64_CHAR_HEX_STRING';  // Internal API authentication
$secrets['api_key_salt']          = 'YOUR_64_CHAR_HEX_STRING';  // API key hashing salt
$secrets['cron_secret']           = 'YOUR_64_CHAR_HEX_STRING';  // Cron job authentication

// ==========================================
// FEATURE FLAGS
// ==========================================
$secrets['bypass_premium_checks'] = true;   // Set to true for self-hosted
$secrets['log_zod_errors']        = true;   // Enable Zod validation error logging

/*
==========================================
DEPLOYMENT QUICK REFERENCE
==========================================

SERVER DETAILS:
- Host: [ssh_host value]
- URL: [project_url value]
- App Path: /var/www/inbox-zero/apps/web

AUTOMATED DEPLOYMENT:
  wsl bash redeploy_ai_agent.sh

MANUAL DEPLOYMENT STEPS:
1. Build locally: wsl bash local_build_fast.sh
2. Upload: wsl sshpass -e scp deployment.tar.gz root@SERVER_IP:/var/www/inbox-zero/
3. Deploy: wsl sshpass -e ssh root@SERVER_IP '/root/deploy_build.sh'
4. Verify: wsl sshpass -e ssh root@SERVER_IP 'tail -n 20 /var/log/inbox-zero.log'

REQUIRED SERVICES ON SERVER:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Cloudflared tunnel service

KEY FILES:
- secrets.php: All credentials (this file, once configured)
- remote_env_file: Template for server .env
- local_build_fast.sh: Local WSL build script
- redeploy_ai_agent.sh: Automated deployment script
- deploy_build.sh: Remote deployment script (on server at /root/)

FULL DOCUMENTATION:
See DEPLOYMENT_GUIDE.md in project root for complete setup instructions.
*/
