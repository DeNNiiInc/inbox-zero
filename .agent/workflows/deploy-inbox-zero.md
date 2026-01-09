---
description: Fully automated deployment of Inbox Zero using secrets.php
---

# Deploy Inbox Zero

This workflow automates the complete deployment of Inbox Zero to a production server. All credentials are read from `secrets.php`.

---

## Prerequisites

Before running this workflow, ensure:

1. **`secrets.php`** exists in the project root with ALL credentials filled in
   - Copy from `secrets.sample.php` if not present
   - Must contain: SSH credentials, API keys, OAuth secrets
2. **WSL environment** with these packages installed:
   - `php` (for parsing secrets.php)
   - `sshpass` (for automated SSH)
   - `pnpm` (for building)
3. **Remote server** has been set up per `DEPLOYMENT_GUIDE.md` Section 2

---

## Workflow Steps

### 1. Verify Prerequisites

// turbo
```bash
php -r "include 'secrets.php'; echo 'SSH Host: ' . \$secrets['ssh_host'] . PHP_EOL;"
```

If this fails, `secrets.php` is missing or malformed.

### 2. Execute Master Deployment Script

The `redeploy_ai_agent.sh` script handles the entire process:
- Parses credentials from `secrets.php`
- Builds locally using `local_build_fast.sh`
- Uploads artifact to remote server
- Executes remote deployment
- Verifies application is running

// turbo
```bash
bash redeploy_ai_agent.sh
```

### 3. Verify Deployment

If Step 2 completes successfully, the application is deployed and running.

To manually verify:
```bash
# Check server status
ssh root@SERVER_IP 'pgrep -f next-server && echo "Running" || echo "Stopped"'

# View recent logs
ssh root@SERVER_IP 'tail -20 /var/log/inbox-zero.log'

# Test endpoint
curl -I https://inbox.beyondcloud.solutions/
```

---

## Troubleshooting

### Build Fails
- Check that `local_build.sh` and `local_build_fast.sh` exist
- Ensure pnpm is installed: `npm install -g pnpm`
- Check Node.js version: `node -v` (must be v22+)

### Upload Fails
- Verify SSH credentials in `secrets.php`
- Test SSH manually: `sshpass -p 'PASSWORD' ssh root@SERVER_IP 'echo OK'`

### Server Not Running After Deploy
- Check logs: `ssh root@SERVER_IP 'cat /var/log/inbox-zero.log'`
- Verify `.env` exists: `ssh root@SERVER_IP 'cat /var/www/inbox-zero/apps/web/.env'`
- Check database: `ssh root@SERVER_IP 'systemctl status postgresql'`
- Check Redis: `ssh root@SERVER_IP 'redis-cli ping'`

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `secrets.php` | All credentials (gitignored) |
| `secrets.sample.php` | Template for secrets.php |
| `redeploy_ai_agent.sh` | Master deployment script |
| `local_build_fast.sh` | Local build wrapper |
| `local_build.sh` | Core build logic |
| `remote_env_file` | Server .env template |
| `deploy_build.sh` | Remote deployment script |
| `DEPLOYMENT_GUIDE.md` | Complete setup documentation |

---

## AI Model Reference (2026)

| Provider | Model | Use Case |
|----------|-------|----------|
| Gmail | `gpt-5-mini` | Cost-effective for high-volume processing |
| Outlook/M365 | `gpt-5.2` | Premium model for complex enterprise tasks |

Model documentation: [OpenAI Models](https://platform.openai.com/docs/models)
