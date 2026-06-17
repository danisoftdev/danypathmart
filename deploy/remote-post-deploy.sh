#!/usr/bin/env bash
# Runs on Hostinger over SSH after rsync (called from GitHub Actions).
# Args: $1 = absolute path to public_html

set -euo pipefail

WEB_ROOT="${1:?WEB_ROOT path required}"
API_DIR="${WEB_ROOT}/api"

if [[ ! -d "$API_DIR" ]]; then
  echo "ERROR: API directory not found: $API_DIR"
  exit 1
fi

cd "$API_DIR"

# Writable dirs for uploads and dev mail dump
mkdir -p uploads/products uploads/searches uploads/avatars uploads/careers uploads/shops uploads/customizations uploads/hero storage/mail
chmod -R 755 uploads storage 2>/dev/null || true

if [[ ! -f .env ]]; then
  echo "WARNING: $API_DIR/.env is missing — create it from .env.production.example before the site can run."
  echo "Skipping migrations and env check until .env exists."
  exit 0
fi

echo "Running database migrations..."
php scripts/migrate-production.php

echo "Running production env check..."
php scripts/check-production-env.php

echo "Post-deploy complete."
