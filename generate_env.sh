#!/bin/bash
# GENERATE SERVER .ENV FROM SECRETS.PHP
# Run this script to generate a complete .env file from secrets.php
# Output can be redirected to a file or piped to the server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_FILE="$SCRIPT_DIR/secrets.php"

if [ ! -f "$SECRETS_FILE" ]; then
    echo "Error: secrets.php not found" >&2
    exit 1
fi

php <<'EOFPHP'
<?php
include 'secrets.php';
global $secrets;

// Build DATABASE_URL from components
$db_url = sprintf(
    "postgresql://%s:%s@%s:%s/%s?schema=public",
    $secrets['db_user'] ?? 'postgres',
    $secrets['db_password'] ?? 'password',
    $secrets['db_host'] ?? 'localhost',
    $secrets['db_port'] ?? '5432',
    $secrets['db_name'] ?? 'inboxzero'
);

echo "# Generated from secrets.php - " . date('Y-m-d H:i:s') . "\n\n";

echo "# Core\n";
echo "NEXT_PUBLIC_BASE_URL=" . ($secrets['project_url'] ?? 'https://localhost:3000') . "\n";
echo "NODE_ENV=production\n\n";

echo "# Database\n";
echo "DATABASE_URL=\"$db_url\"\n";
echo "DIRECT_URL=\"$db_url\"\n\n";

echo "# Redis\n";
echo "REDIS_URL=\"" . ($secrets['redis_url'] ?? 'redis://localhost:6379') . "\"\n\n";

echo "# AI Providers\n";
echo "DEFAULT_LLM_PROVIDER=\"" . ($secrets['default_llm_provider'] ?? 'openai') . "\"\n";
echo "DEFAULT_LLM_MODEL=\"" . ($secrets['default_llm_model'] ?? 'gpt-5.2') . "\"\n";
echo "CHAT_LLM_PROVIDER=\"" . ($secrets['chat_llm_provider'] ?? 'openai') . "\"\n";
echo "CHAT_LLM_MODEL=\"" . ($secrets['chat_llm_model'] ?? 'gpt-5-mini') . "\"\n";
echo "ECONOMY_LLM_PROVIDER=\"" . ($secrets['economy_llm_provider'] ?? 'openai') . "\"\n";
echo "ECONOMY_LLM_MODEL=\"" . ($secrets['economy_llm_model'] ?? 'gpt-5-mini') . "\"\n";
echo "OPENAI_API_KEY=\"" . ($secrets['openai_api_key'] ?? '') . "\"\n";
echo "ANTHROPIC_API_KEY=\"" . ($secrets['anthropic_api_key'] ?? '') . "\"\n";
echo "OPENROUTER_API_KEY=\"" . ($secrets['openrouter_api_key'] ?? '') . "\"\n\n";

echo "# QStash\n";
echo "QSTASH_URL=\"" . ($secrets['qstash_url'] ?? 'https://qstash.upstash.io') . "\"\n";
echo "QSTASH_TOKEN=\"" . ($secrets['qstash_token'] ?? '') . "\"\n";
echo "QSTASH_CURRENT_SIGNING_KEY=\"" . ($secrets['qstash_current_signing_key'] ?? '') . "\"\n";
echo "QSTASH_NEXT_SIGNING_KEY=\"" . ($secrets['qstash_next_signing_key'] ?? '') . "\"\n\n";

echo "# Microsoft OAuth\n";
echo "MICROSOFT_CLIENT_ID=\"" . ($secrets['microsoft_client_id'] ?? '') . "\"\n";
echo "MICROSOFT_CLIENT_SECRET=\"" . ($secrets['microsoft_client_secret'] ?? '') . "\"\n";
echo "MICROSOFT_TENANT_ID=\"" . ($secrets['microsoft_tenant_id'] ?? 'common') . "\"\n";
echo "MICROSOFT_WEBHOOK_CLIENT_STATE=\"" . ($secrets['microsoft_webhook_client_state'] ?? '') . "\"\n\n";

echo "# Google OAuth\n";
echo "GOOGLE_CLIENT_ID=\"" . ($secrets['google_client_id'] ?? 'placeholder') . "\"\n";
echo "GOOGLE_CLIENT_SECRET=\"" . ($secrets['google_client_secret'] ?? 'placeholder') . "\"\n";
echo "GOOGLE_PUBSUB_TOPIC_NAME=\"" . ($secrets['google_pubsub_topic_name'] ?? 'projects/placeholder/topics/placeholder') . "\"\n";
echo "GOOGLE_PUBSUB_VERIFICATION_TOKEN=\"" . ($secrets['google_pubsub_verification_token'] ?? '') . "\"\n\n";

echo "# Security Keys\n";
echo "AUTH_SECRET=\"" . ($secrets['auth_secret'] ?? '') . "\"\n";
echo "EMAIL_ENCRYPT_SECRET=\"" . ($secrets['email_encrypt_secret'] ?? '') . "\"\n";
echo "EMAIL_ENCRYPT_SALT=\"" . ($secrets['email_encrypt_salt'] ?? '') . "\"\n";
echo "INTERNAL_API_KEY=\"" . ($secrets['internal_api_key'] ?? '') . "\"\n";
echo "API_KEY_SALT=\"" . ($secrets['api_key_salt'] ?? '') . "\"\n";
echo "CRON_SECRET=\"" . ($secrets['cron_secret'] ?? '') . "\"\n\n";

echo "# Feature Flags\n";
echo "NEXT_PUBLIC_BYPASS_PREMIUM_CHECKS=" . (($secrets['bypass_premium_checks'] ?? true) ? 'true' : 'false') . "\n";
echo "LOG_ZOD_ERRORS=" . (($secrets['log_zod_errors'] ?? true) ? 'true' : 'false') . "\n";
?>
EOFPHP
