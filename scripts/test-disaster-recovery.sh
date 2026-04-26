#!/usr/bin/env bash
# scripts/test-disaster-recovery.sh
#
# End-to-end disaster recovery drill for Stellar-Spend.
# Restores the latest snapshot to a temporary instance, verifies schema
# and data integrity, then cleans up. Safe to run against production
# snapshots — it never touches the live instance.
#
# Usage:
#   ./scripts/test-disaster-recovery.sh <db-identifier> [region]
#
# Examples:
#   ./scripts/test-disaster-recovery.sh stellar-spend-production-db
#   ./scripts/test-disaster-recovery.sh stellar-spend-staging-db us-west-2
#
# Requirements:
#   - aws CLI with RDS read + write permissions
#   - psql on PATH
#   - Restored instance must be reachable (adjust security groups if needed)

set -euo pipefail

SOURCE_DB="${1:?Usage: $0 <db-identifier> [region]}"
REGION="${2:-us-east-1}"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
TEST_DB="${SOURCE_DB}-drtest-${TIMESTAMP}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
pass()  { echo -e "${GREEN}✓${NC} $*"; }
fail()  { echo -e "${RED}✗${NC} $*"; FAILED=1; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
step()  { echo -e "\n${BOLD}--- $*${NC}"; }
FAILED=0

cleanup() {
  if aws rds describe-db-instances \
      --db-instance-identifier "$TEST_DB" \
      --region "$REGION" &>/dev/null; then
    echo ""
    echo "==> Cleaning up test instance: $TEST_DB"
    aws rds delete-db-instance \
      --db-instance-identifier "$TEST_DB" \
      --skip-final-snapshot \
      --region "$REGION" > /dev/null
    echo "    Deletion initiated (instance will be removed in a few minutes)."
  fi
}
trap cleanup EXIT

echo -e "${BOLD}==> Disaster Recovery Drill${NC}"
echo "    Source DB  : $SOURCE_DB"
echo "    Test DB    : $TEST_DB"
echo "    Region     : $REGION"
echo "    Started at : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# ── Phase 1: Verify source backups ────────────────────────────────────────────
step "Phase 1: Verify source backup health"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if "$SCRIPT_DIR/verify-backup.sh" "$SOURCE_DB" "$REGION"; then
  pass "Source backup verification passed"
else
  fail "Source backup verification failed — aborting DR test"
  exit 1
fi

# ── Phase 2: Restore to test instance ────────────────────────────────────────
step "Phase 2: Restore latest snapshot to test instance"
SNAPSHOT_ID=$(aws rds describe-db-snapshots \
  --db-instance-identifier "$SOURCE_DB" \
  --snapshot-type automated \
  --region "$REGION" \
  --query 'sort_by(DBSnapshots, &SnapshotCreateTime)[-1].DBSnapshotIdentifier' \
  --output text)

echo "    Snapshot : $SNAPSHOT_ID"
echo "    Restoring (this takes ~10–20 minutes)..."

RESTORE_START=$(date +%s)

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier "$TEST_DB" \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --db-instance-class db.t4g.micro \
  --no-publicly-accessible \
  --region "$REGION" \
  --output text > /dev/null

aws rds wait db-instance-available \
  --db-instance-identifier "$TEST_DB" \
  --region "$REGION"

RESTORE_END=$(date +%s)
RESTORE_MINS=$(( (RESTORE_END - RESTORE_START) / 60 ))
pass "Restore completed in ${RESTORE_MINS} minutes"

# ── Phase 3: Validate restored instance ──────────────────────────────────────
step "Phase 3: Validate restored instance"

DB_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier "$TEST_DB" \
  --region "$REGION" \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text)

[[ "$DB_STATUS" == "available" ]] && pass "Instance status: available" || fail "Instance status: $DB_STATUS"

ENCRYPTED=$(aws rds describe-db-instances \
  --db-instance-identifier "$TEST_DB" \
  --region "$REGION" \
  --query 'DBInstances[0].StorageEncrypted' \
  --output text)
[[ "$ENCRYPTED" == "True" ]] && pass "Storage is encrypted" || fail "Storage is NOT encrypted"

ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$TEST_DB" \
  --region "$REGION" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)
echo "    Endpoint: $ENDPOINT"

# ── Phase 4: Schema and data integrity check ──────────────────────────────────
step "Phase 4: Schema and data integrity"
if [[ -z "${DATABASE_URL:-}" ]]; then
  warn "DATABASE_URL not set — skipping schema/data checks"
  warn "To enable: export DATABASE_URL=postgresql://user:pass@${ENDPOINT}:5432/stellar_spend"
else
  EXPECTED_TABLES=(
    transactions
    idempotency_keys
    api_keys
    api_key_usage_events
    transaction_notification_preferences
    transaction_notification_deliveries
  )

  for TABLE in "${EXPECTED_TABLES[@]}"; do
    EXISTS=$(psql "$DATABASE_URL" -tAc \
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='$TABLE');" \
      2>/dev/null || echo "f")
    [[ "$EXISTS" == "t" ]] && pass "Table: $TABLE" || fail "Missing table: $TABLE"
  done

  # Row counts — just verify queries succeed (non-zero is a bonus)
  TX_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM transactions;" 2>/dev/null || echo "error")
  if [[ "$TX_COUNT" != "error" ]]; then
    pass "transactions is queryable (${TX_COUNT} rows)"
  else
    fail "Could not query transactions"
  fi

  # Verify indexes exist
  IDX_COUNT=$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename='transactions';" 2>/dev/null || echo "0")
  [[ "$IDX_COUNT" -ge 3 ]] && pass "transactions indexes present (${IDX_COUNT})" \
    || warn "Expected ≥3 indexes on transactions, found ${IDX_COUNT}"
fi

# ── Phase 5: Migration replay ─────────────────────────────────────────────────
step "Phase 5: Migration idempotency check"
if [[ -z "${DATABASE_URL:-}" ]]; then
  warn "DATABASE_URL not set — skipping migration replay"
else
  MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../migrations" && pwd)"
  for SQL_FILE in "$MIGRATIONS_DIR"/*.sql; do
    MIGRATION=$(basename "$SQL_FILE")
    if psql "$DATABASE_URL" -f "$SQL_FILE" -v ON_ERROR_STOP=1 &>/dev/null; then
      pass "Migration idempotent: $MIGRATION"
    else
      fail "Migration failed on re-run: $MIGRATION"
    fi
  done
fi

# ── Summary ───────────────────────────────────────────────────────────────────
TOTAL_MINS=$(( ($(date +%s) - RESTORE_START) / 60 ))
echo ""
echo -e "${BOLD}==> DR Drill Summary${NC}"
echo "    Total duration : ${TOTAL_MINS} minutes"
echo "    Restore time   : ${RESTORE_MINS} minutes"
echo "    Snapshot used  : $SNAPSHOT_ID"

if [[ "$FAILED" -eq 0 ]]; then
  echo -e "    Result         : ${GREEN}PASSED${NC}"
  echo ""
  echo "    RTO estimate: ~${RESTORE_MINS} minutes (snapshot restore)"
  echo "    RPO estimate: up to 24 hours (last automated snapshot)"
  exit 0
else
  echo -e "    Result         : ${RED}FAILED — review errors above${NC}"
  exit 1
fi
