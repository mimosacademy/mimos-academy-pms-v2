#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PB_BASE_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="${PB_SUPERUSER_EMAIL:-ci-admin@example.invalid}"
ADMIN_PASSWORD="${PB_SUPERUSER_PASSWORD:-CiTest-Password-2026-Strong!}"
TMP_DIR="${TMPDIR:-/tmp}/mimos-role-smoke"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

api() { curl -sS -w '\n%{http_code}' "$@"; }

expect_status() {
  local expected="$1"; shift
  local response status
  response="$(api "$@")"
  status="$(printf '%s' "$response" | tail -n 1)"
  if [[ "$status" != "$expected" ]]; then
    echo "Expected HTTP $expected, received HTTP $status for: $*"
    printf '%s\n' "$response"
    return 1
  fi
}

expect_empty_list() {
  local token="$1" url="$2" response status body total
  response="$(api -H "Authorization: $token" "$url")"
  status="$(printf '%s' "$response" | tail -n 1)"
  body="$(printf '%s' "$response" | sed '$d')"
  [[ "$status" == "200" ]] || { echo "Expected HTTP 200 list response, got $status"; printf '%s\n' "$response"; return 1; }
  total="$(printf '%s' "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("totalItems",-1))')"
  [[ "$total" == "0" ]] || { echo "Expected filtered list to contain zero records, got $total"; printf '%s\n' "$body"; return 1; }
}

login_token() {
  local collection="$1" identity="$2" password="$3"
  api -X POST -H 'Content-Type: application/json' \
    -d "{\"identity\":\"$identity\",\"password\":\"$password\"}" \
    "$BASE_URL/api/collections/$collection/auth-with-password" \
    | sed '$d' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

create_record() {
  local token="$1" collection="$2" payload="$3"
  curl -fsS -X POST -H "Authorization: $token" -H 'Content-Type: application/json' \
    -d "$payload" "$BASE_URL/api/collections/$collection/records"
}

ADMIN_TOKEN="$(login_token _superusers "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
AUTH_HEADER="Authorization: $ADMIN_TOKEN"

roles=(manager finance sales programme_pic trainer viewer)
for role in "${roles[@]}"; do
  email="ci-${role}@example.invalid"
  password='CiRole-Password-2026-Strong!'
  curl -fsS -X POST \
    -H "$AUTH_HEADER" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"passwordConfirm\":\"$password\",\"name\":\"CI ${role}\",\"role\":\"$role\",\"verified\":true}" \
    "$BASE_URL/api/collections/users/records" >"$TMP_DIR/${role}.json"
done

login_role() { login_token users "ci-$1@example.invalid" 'CiRole-Password-2026-Strong!'; }
role_id() { python3 - "$TMP_DIR/$1.json" <<'PY'
import json,sys
with open(sys.argv[1]) as f: print(json.load(f)['id'])
PY
}

# List rules are record filters: a denied list request returns HTTP 200 with zero records.
token="$(login_role manager)"
expect_status 200 -H "Authorization: $token" "$BASE_URL/api/collections/users/records?perPage=1"
token="$(login_role viewer)"
expect_empty_list "$token" "$BASE_URL/api/collections/users/records?perPage=1"

for role in finance sales programme_pic trainer viewer; do
  token="$(login_role "$role")"
  expect_status 200 -H "Authorization: $token" "$BASE_URL/api/collections/clients/records?perPage=1"
done

# Mutation authorization: allowed roles reach schema validation (400 with an empty payload),
# while denied roles are rejected by the collection rule (403).
expect_create_status() {
  local role="$1" expected="$2" collection="$3"
  local token="$(login_role "$role")"
  expect_status "$expected" -X POST -H "Authorization: $token" -H 'Content-Type: application/json' \
    -d '{}' "$BASE_URL/api/collections/$collection/records"
}
expect_create_status sales 400 clients
expect_create_status viewer 403 clients
expect_create_status finance 400 invoices
expect_create_status sales 403 invoices
expect_create_status trainer 400 training_delivery
expect_create_status viewer 403 training_delivery
expect_create_status finance 400 payments
expect_create_status trainer 403 payments
expect_create_status manager 403 users
expect_create_status viewer 403 users
expect_create_status viewer 403 audit_history
expect_create_status manager 400 audit_history

# Financial integrity E2E: create real records, then prove server-side guards reject overpayment
# and reducing an invoice below already recorded collections.
MANAGER_TOKEN="$(login_role manager)"
FINANCE_TOKEN="$(login_role finance)"
MANAGER_ID="$(role_id manager)"
FINANCE_ID="$(role_id finance)"

CLIENT_JSON="$(create_record "$MANAGER_TOKEN" clients "{\"name\":\"CI Financial Integrity Client\",\"status\":\"Active\",\"createdBy\":\"$MANAGER_ID\"}")"
CLIENT_ID="$(printf '%s' "$CLIENT_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
PROGRAMME_JSON="$(create_record "$MANAGER_TOKEN" programmes "{\"client\":\"$CLIENT_ID\",\"code\":\"CI-FIN-001\",\"title\":\"CI Financial Integrity Programme\",\"status\":\"Scheduled\",\"contractValue\":1000,\"createdBy\":\"$MANAGER_ID\"}")"
PROGRAMME_ID="$(printf '%s' "$PROGRAMME_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
INVOICE_JSON="$(create_record "$FINANCE_TOKEN" invoices "{\"programme\":\"$PROGRAMME_ID\",\"client\":\"$CLIENT_ID\",\"invoiceNo\":\"CI-INV-001\",\"description\":\"CI integrity test\",\"amount\":1000,\"paidAmount\":0,\"status\":\"Unpaid\",\"createdBy\":\"$FINANCE_ID\"}")"
INVOICE_ID="$(printf '%s' "$INVOICE_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

create_record "$FINANCE_TOKEN" payments "{\"invoice\":\"$INVOICE_ID\",\"programme\":\"$PROGRAMME_ID\",\"client\":\"$CLIENT_ID\",\"paymentNo\":\"CI-PAY-001\",\"amount\":600,\"method\":\"Bank Transfer\",\"status\":\"Completed\",\"createdBy\":\"$FINANCE_ID\"}" >/dev/null
expect_status 400 -X POST -H "Authorization: $FINANCE_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"invoice\":\"$INVOICE_ID\",\"programme\":\"$PROGRAMME_ID\",\"client\":\"$CLIENT_ID\",\"paymentNo\":\"CI-PAY-002\",\"amount\":401,\"method\":\"Bank Transfer\",\"status\":\"Completed\",\"createdBy\":\"$FINANCE_ID\"}" \
  "$BASE_URL/api/collections/payments/records"
expect_status 400 -X PATCH -H "Authorization: $FINANCE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"amount":500}' "$BASE_URL/api/collections/invoices/records/$INVOICE_ID"

echo "Role matrix and financial integrity E2E smoke tests passed."
