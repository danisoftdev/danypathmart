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
mkdir -p uploads/products uploads/searches uploads/avatars uploads/careers uploads/shops uploads/customizations uploads/hero uploads/support-chat uploads/legal storage/mail
chmod -R 755 uploads storage 2>/dev/null || true

if [[ ! -f .env ]]; then
  echo "WARNING: $API_DIR/.env is missing — create it from .env.production.example before the site can run."
  echo "Skipping migrations and env check until .env exists."
  exit 0
fi

echo "Running database migrations..."
# Always apply database/migrations/*.sql on deploy — no manual migrate needed.
if ! php scripts/migrate-production.php; then
  echo "migrate-production failed — falling back to migrate-all.php directly..."
  php scripts/migrate-all.php
fi

echo "Running production env check..."
# Env check is advisory after a successful rsync — do not fail the GitHub Action.
# Code is already live; fix api/.env on the server if this prints errors.
if ! php scripts/check-production-env.php; then
  echo ""
  echo "WARNING: production env check reported issues (deploy files already uploaded)."
  echo "Fix ${API_DIR}/.env on Hostinger when you can — JWT_SECRET, CORS_ORIGIN, APP_URL, APP_ENV."
fi

echo "Running shop storefront cron (reminders + unpaid cleanup)..."
php scripts/shop-storefront-cron.php || true

echo "Refreshing legal policies from docs..."
php scripts/seed-legal-policies.php || true

echo "Post-deploy complete."
