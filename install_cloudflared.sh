#!/bin/bash

# Cloudflare Tunnel Installation Script
# This script installs cloudflared and sets up the tunnel service.

set -e

# Function to check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "Installing dependencies..."
apt-get update && apt-get install -y curl git vim

echo "Adding Cloudflare GPG key..."
mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

echo "Adding Cloudflare repository..."
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | tee /etc/apt/sources.list.d/cloudflared.list

echo "Installing cloudflared..."
apt-get update && apt-get install -y cloudflared

echo "Cloudflared installed successfully."

# Check if token is provided as argument
if [ -z "$1" ]; then
    echo "Usage: $0 <tunnel_token>"
    echo "Please provide the tunnel token as an argument to install the service."
    exit 1
else
    echo "Installing Cloudflare tunnel service..."
    cloudflared service install "$1"
    echo "Tunnel service installed and started."
fi
