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

php <<'EOFPHP' | tr -d '\r'
<?php
include 'secrets.php';
global $secrets, $openai_api_key, $anthropic_api_key, $openrouter_key, $ollama_api_key, $ollama_model, $ollama_base_url, $qstash_url, $qstash_token, $qstash_current_signing_key, $qstash_next_signing_key;

function clean_val($val) {
    if ($val === null) return '';
    // Remove ALL carriage returns, newlines, and non-printable characters that might cause corruption
    return str_replace(["\r", "\n"], '', trim($val));
}

// Build DATABASE_URL from components
$db_url = sprintf(
    "postgresql://%s:%s@%s:%s/%s?schema=public",
    clean_val($secrets['db_user'] ?? 'postgres'),
    clean_val($secrets['db_password'] ?? 'password'),
    clean_val($secrets['db_host'] ?? 'localhost'),
    clean_val($secrets['db_port'] ?? '5432'),
    clean_val($secrets['db_name'] ?? 'inboxzero')
);

echo "# Generated from secrets.php - " . date('Y-m-d H:i:s') . "\n\n";

echo "# Core\n";
echo "NEXT_PUBLIC_BASE_URL=" . clean_val($secrets['project_url'] ?? 'https://localhost:3000') . "\n";
echo "NODE_ENV=production\n\n";

echo "# Database\n";
echo "DATABASE_URL=\"$db_url\"\n";
echo "DIRECT_URL=\"$db_url\"\n\n";

echo "# Redis\n";
echo "REDIS_URL=\"" . clean_val($secrets['redis_url'] ?? 'redis://localhost:6379') . "\"\n";
echo "UPSTASH_REDIS_URL=\"" . clean_val($secrets['upstash_redis_url'] ?? '') . "\"\n";
echo "UPSTASH_REDIS_TOKEN=\"" . clean_val($secrets['upstash_redis_token'] ?? '') . "\"\n\n";

echo "# AI Providers\n";
echo "DEFAULT_LLM_PROVIDER=\"" . clean_val($secrets['default_llm_provider'] ?? 'openai') . "\"\n";
echo "DEFAULT_LLM_MODEL=\"" . clean_val($secrets['default_llm_model'] ?? 'gpt-5-mini') . "\"\n";
echo "CHAT_LLM_PROVIDER=\"" . clean_val($secrets['chat_llm_provider'] ?? 'openai') . "\"\n";
echo "CHAT_LLM_MODEL=\"" . clean_val($secrets['chat_llm_model'] ?? 'gpt-5-mini') . "\"\n";
echo "ECONOMY_LLM_PROVIDER=\"" . clean_val($secrets['economy_llm_provider'] ?? 'openai') . "\"\n";
echo "ECONOMY_LLM_MODEL=\"" . clean_val($secrets['economy_llm_model'] ?? 'gpt-5-nano') . "\"\n";
echo "OPENAI_API_KEY=\"" . clean_val($secrets['openai_api_key'] ?? $openai_api_key ?? '') . "\"\n";
echo "ANTHROPIC_API_KEY=\"" . clean_val($secrets['anthropic_api_key'] ?? $anthropic_api_key ?? '') . "\"\n";
echo "OPENROUTER_API_KEY=\"" . clean_val($secrets['openrouter_api_key'] ?? $openrouter_key ?? '') . "\"\n\n";

echo "# Ollama (if configured)\n";
$o_key = clean_val($ollama_api_key);
if (!empty($o_key)) {
    echo "OLLAMA_API_KEY=\"" . $o_key . "\"\n";
    echo "OLLAMA_MODEL=\"" . clean_val($ollama_model ?? '') . "\"\n";
    echo "OLLAMA_BASE_URL=\"" . clean_val($ollama_base_url ?? '') . "\"\n\n";
}

echo "# QStash\n";
echo "QSTASH_URL=\"" . clean_val($secrets['qstash_url'] ?? $qstash_url ?? 'https://qstash.upstash.io') . "\"\n";
echo "QSTASH_TOKEN=\"" . clean_val($secrets['qstash_token'] ?? $qstash_token ?? '') . "\"\n";
echo "QSTASH_CURRENT_SIGNING_KEY=\"" . clean_val($secrets['qstash_current_signing_key'] ?? $qstash_current_signing_key ?? '') . "\"\n";
echo "QSTASH_NEXT_SIGNING_KEY=\"" . clean_val($secrets['qstash_next_signing_key'] ?? $qstash_next_signing_key ?? '') . "\"\n\n";

echo "# Microsoft OAuth\n";
echo "MICROSOFT_CLIENT_ID=\"" . clean_val($secrets['microsoft_client_id'] ?? '') . "\"\n";
echo "MICROSOFT_CLIENT_SECRET=\"" . clean_val($secrets['microsoft_client_secret'] ?? '') . "\"\n";
echo "MICROSOFT_TENANT_ID=\"" . clean_val($secrets['microsoft_tenant_id'] ?? 'common') . "\"\n";
echo "MICROSOFT_WEBHOOK_CLIENT_STATE=\"" . clean_val($secrets['microsoft_webhook_client_state'] ?? '') . "\"\n\n";

echo "# Google OAuth\n";
echo "GOOGLE_CLIENT_ID=\"" . clean_val($secrets['google_client_id'] ?? 'placeholder') . "\"\n";
echo "GOOGLE_CLIENT_SECRET=\"" . clean_val($secrets['google_client_secret'] ?? 'placeholder') . "\"\n";
echo "GOOGLE_PUBSUB_TOPIC_NAME=\"" . clean_val($secrets['google_pubsub_topic_name'] ?? 'projects/placeholder/topics/placeholder') . "\"\n";
echo "GOOGLE_PUBSUB_VERIFICATION_TOKEN=\"" . clean_val($secrets['google_pubsub_verification_token'] ?? '') . "\"\n\n";

echo "# Security Keys\n";
echo "AUTH_SECRET=\"" . clean_val($secrets['auth_secret'] ?? '') . "\"\n";
echo "EMAIL_ENCRYPT_SECRET=\"" . clean_val($secrets['email_encrypt_secret'] ?? '') . "\"\n";
echo "EMAIL_ENCRYPT_SALT=\"" . clean_val($secrets['email_encrypt_salt'] ?? '') . "\"\n";
echo "INTERNAL_API_KEY=\"" . clean_val($secrets['internal_api_key'] ?? '') . "\"\n";
echo "API_KEY_SALT=\"" . clean_val($secrets['api_key_salt'] ?? '') . "\"\n";
echo "CRON_SECRET=\"" . clean_val($secrets['cron_secret'] ?? '') . "\"\n\n";

echo "# Feature Flags\n";
echo "NEXT_PUBLIC_BYPASS_PREMIUM_CHECKS=" . (($secrets['bypass_premium_checks'] ?? true) ? 'true' : 'false') . "\n";
echo "LOG_ZOD_ERRORS=" . (($secrets['log_zod_errors'] ?? true) ? 'true' : 'false') . "\n";
?>
EOFPHP
