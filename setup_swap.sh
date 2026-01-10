#!/bin/bash
set -e

echo "Setting up swap..."
if [ -f /swapfile ]; then
    echo "Swap file already exists."
else
    dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
    echo "Swap created successfully."
fi
