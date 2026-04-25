#!/usr/bin/env bash
# rotate-secret.sh
# Guides the operator through rotating a specific secret.
# Updates the value in the specified env file and prints next steps.
#
# Usage:
#   ./scripts/rotate-secret.sh <SECRET_NAME> [env-file]
#
# Example:
#   ./scripts/rotate-secret.sh PAYCREST_API_KEY .env.local

set -euo pipefail

SECRET_NAME="${1:-}"
ENV_FILE="${2:-.env.local}"

if [ -z "$SECRET_NAME" ]; then
  echo "Usage: $0 <SECRET_NAME> [env-file]" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found: ${ENV_FILE}" >&2
  exit 1
fi

# Prompt for the new value (hidden input)
echo "Rotating secret: ${SECRET_NAME}"
echo "Enter new value (input hidden):"
read -rs NEW_VALUE
echo ""

if [ -z "$NEW_VALUE" ]; then
  echo "ERROR: New value cannot be empty." >&2
  exit 1
fi

# Backup the env file before modifying
BACKUP="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
cp "$ENV_FILE" "$BACKUP"
echo "Backup created: ${BACKUP}"

# Replace the value in the env file
if grep -q "^${SECRET_NAME}=" "$ENV_FILE"; then
  sed "s|^${SECRET_NAME}=.*|${SECRET_NAME}=${NEW_VALUE}|" "$ENV_FILE" > "${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  echo "Updated ${SECRET_NAME} in ${ENV_FILE}"
else
  echo "${SECRET_NAME}=${NEW_VALUE}" >> "$ENV_FILE"
  echo "Added ${SECRET_NAME} to ${ENV_FILE}"
fi

echo ""
echo "==> Next steps after rotating ${SECRET_NAME}:"
case "$SECRET_NAME" in
  PAYCREST_API_KEY)
    echo "  1. Update the key in the Paycrest dashboard."
    echo "  2. Redeploy the application so the new key takes effect."
    echo "  3. Revoke the old key in the Paycrest dashboard."
    ;;
  PAYCREST_WEBHOOK_SECRET)
    echo "  1. Update the webhook secret in the Paycrest dashboard."
    echo "  2. Redeploy the application."
    ;;
  BASE_PRIVATE_KEY)
    echo "  1. Transfer any remaining funds from the old wallet to the new wallet."
    echo "  2. Update BASE_RETURN_ADDRESS and NEXT_PUBLIC_BASE_RETURN_ADDRESS if the address changed."
    echo "  3. Redeploy the application."
    ;;
  *)
    echo "  1. Redeploy the application so the new value takes effect."
    ;;
esac
echo ""
echo "  Run ./scripts/validate-secrets.sh ${ENV_FILE} to verify the updated configuration."
