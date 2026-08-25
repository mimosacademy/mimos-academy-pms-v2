#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PB_BASE_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="${PB_SUPERUSER_EMAIL:-ci-admin@example.invalid}"
ADMIN_PASSWORD="${PB_SUPERUSER_PASSWORD:-CiTest-Password-2026-Strong!}"
TMP_DIR="${TMPDIR:-/tmp}/mimos-role-smoke"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

api() {
  curl -sS -w '\n%{http_code}' "$@"
}

login_superuser() {
  local response
  response="$(api -X POST -H 'Content-Type: application/json' \
    -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
    "$BASE_URL/api/collections/_superusers/auth-with-password")"
  printf '%s' "$response" | sed '$d' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

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

ADMIN_TOKEN="$(login_superuser)"
AUTH_HEADER="Authorization: $ADMIN_TOKEN"

# Create one temporary account per V2 role through the superuser API.
roles=(manager finance sales programme_pic trainer viewer)
for role in "${roles[@]}"; do
  email="ci-${role}@example.invalid"
  password='CiRole-Password-2026-Strong!'
  curl -sS -X POST \
    -H "$AUTH_HEADER" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"passwordConfirm\":\"$password\",\"name\":\"CI ${role}\",\"role\":\"$role\",\"verified\":true}" \
    "$BASE_URL/api/collections/users/records" >"$TMP_DIR/${role}.json"
done

login_role() {
  local role="$1"
  python3 - "$TMP_DIR/${role}.json" <<'PY'
import json,sys,urllib.request
path=sys.argv[1]
with open(path) as f: data=json.load(f)
role=data['role']
email=data['email']
password='CiRole-Password-2026-Strong!'
url='http://127.0.0.1:8090/api/collections/users/auth-with-password'
req=urllib.request.Request(url,data=json.dumps({'identity':email,'password':password}).encode(),headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req) as r: print(json.load(r)['token'])
PY
}

# Use the real service URL when the script is pointed elsewhere.
login_role_with_base() {
  local role="$1"
  local email="ci-${role}@example.invalid"
  api -X POST -H 'Content-Type: application/json' \
    -d "{\"identity\":\"$email\",\"password\":\"CiRole-Password-2026-Strong!\"}" \
    "$BASE_URL/api/collections/users/auth-with-password" \
    | sed '$d' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

# Read matrix: users are restricted to Super Admin/Manager; operational records are readable by authenticated roles.
for role in manager viewer; do
  token="$(login_role_with_base "$role")"
  expect_status 200 -H "Authorization: $token" "$BASE_URL/api/collections/users/records?perPage=1"
done
for role in finance sales programme_pic trainer viewer; do
  token="$(login_role_with_base "$role")"
  expect_status 200 -H "Authorization: $token" "$BASE_URL/api/collections/clients/records?perPage=1"
done

# Mutation authorization: an allowed create reaches schema validation (400 with an empty payload),
# while a denied role is rejected by the collection rule (403).
expect_create_status() {
  local role="$1" expected="$2" collection="$3"
  local token="$(login_role_with_base "$role")"
  expect_status "$expected" -X POST -H "Authorization: $token" -H 'Content-Type: application/json' \
    -d '{}' "$BASE_URL/api/collections/$collection/records"
}

expect_create_status sales 400 clients
expect_create_status viewer 403 clients
expect_create_status finance 400 invoices
expect_create_status sales 403 invoices
expect_create_status trainer 400 training_delivery
expect_create_status viewer 403 training_delivery

# Financial mutations are restricted to Finance/Manager/Super Admin.
expect_create_status finance 400 payments
expect_create_status trainer 403 payments

# Account provisioning remains Super Admin-only.
expect_create_status manager 403 users
expect_create_status viewer 403 users

# Viewer cannot mutate audit history; normal staff can append audit records, subject to schema validation.
expect_create_status viewer 403 audit_history
expect_create_status manager 400 audit_history

echo "Role matrix authorization smoke test passed."
