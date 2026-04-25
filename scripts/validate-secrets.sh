#!/usr/bin/env bash
# validate-secrets.sh
# Validates that all required secrets are present and that no secrets
# are accidentally exposed via NEXT_PUBLIC_ prefixed variables.
#
# Usage:
#   ./scripts/validate-secrets.sh [env-file]
#   ./scripts/validate-secrets.sh .env.local
#   ./scripts/validate-secrets.sh .env.production

set -euo pipefail

ENV_FILE="${1:-.env.local}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found: ${ENV_FILE}" >&2
  echo "Copy .env.example to ${ENV_FILE} and fill in the values." >&2
  exit 1
fi

# Load the env file (skip comments and blank lines)
# shellcheck disable=SC2046
export $(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | xargs)

ERRORS=0

required_server_vars=(
  PAYCREST_API_KEY
  PAYCREST_WEBHOOK_SECRET
  BASE_PRIVATE_KEY
  BASE_RETURN_ADDRESS
  BASE_RPC_URL
  STELLAR_SOROBAN_RPC_URL
  STELLAR_HORIZON_URL
)

required_public_vars=(
  NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL
  NEXT_PUBLIC_BASE_RETURN_ADDRESS
  NEXT_PUBLIC_STELLAR_USDC_ISSUER
)

# Secrets that must NEVER have a NEXT_PUBLIC_ variant
forbidden_public_secrets=(
  NEXT_PUBLIC_PAYCREST_API_KEY
  NEXT_PUBLIC_BASE_PRIVATE_KEY
  NEXT_PUBLIC_PAYCREST_WEBHOOK_SECRET
)

echo "==> Checking required server-side secrets..."
for var in "${required_server_vars[@]}"; do
  value="${!var:-}"
  if [ -z "$value" ] || [[ "$value" == *"your_"* ]] || [[ "$value" == *"_here"* ]]; then
    echo "  MISSING or placeholder: ${var}"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: ${var}"
  fi
done

echo ""
echo "==> Checking required public variables..."
for var in "${required_public_vars[@]}"; do
  value="${!var:-}"
  if [ -z "$value" ] || [[ "$value" == *"your_"* ]] || [[ "$value" == *"_here"* ]]; then
    echo "  MISSING or placeholder: ${var}"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: ${var}"
  fi
done

echo ""
echo "==> Checking for accidentally exposed secrets..."
for var in "${forbidden_public_secrets[@]}"; do
  value="${!var:-}"
  if [ -n "$value" ]; then
    echo "  FORBIDDEN: ${var} must not be set (secrets must not use NEXT_PUBLIC_ prefix)"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: ${var} is not set"
  fi
done

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "==> FAILED: ${ERRORS} issue(s) found in ${ENV_FILE}" >&2
  exit 1
else
  echo "==> All secrets validated successfully."
fi
