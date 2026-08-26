#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PB_BASE_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="${PB_BOOTSTRAP_USER_EMAIL:-ci-superadmin@example.com}"
ADMIN_PASSWORD="${PB_BOOTSTRAP_USER_PASSWORD:-CiApp-Password-2026-Strong!}"
ROLE_PASSWORD='CiRole-Password-2026-Strong!'
TMP_DIR="${TMPDIR:-/tmp}/mimos-role-smoke"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

api() { curl -sS -w '\n%{http_code}' "$@"; }
status() { printf '%s' "$1" | tail -n1; }
body() { printf '%s' "$1" | sed '$d'; }

expect_status() {
  local expected="$1"
  shift
  local response code
  response="$(api "$@")"
  code="$(status "$response")"
  if [[ "$code" != "$expected" ]]; then
    echo "Expected HTTP $expected, got $code: $*"
    body "$response"
    return 1
  fi
}

login() {
  local collection="$1"
  local identity="$2"
  local password="$3"
  local response code payload

  response="$(api -X POST -H 'Content-Type: application/json' \
    -d "{\"identity\":\"$identity\",\"password\":\"$password\"}" \
    "$BASE_URL/api/collections/$collection/auth-with-password")"
  code="$(status "$response")"
  payload="$(body "$response")"

  if [[ "$code" != "200" ]]; then
    echo "Authentication failed: collection=$collection identity=$identity HTTP=$code" >&2
    printf '%s\n' "$payload" >&2
    return 1
  fi

  printf '%s' "$payload" | python3 -c 'import json,sys
payload=json.load(sys.stdin)
token=payload.get("token")
if not token:
    raise SystemExit("Authentication response did not contain token")
print(token)'
}

create_record() {
  local token="$1"
  local collection="$2"
  local payload="$3"
  local response code

  response="$(api -X POST \
    -H "Authorization: $token" \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    "$BASE_URL/api/collections/$collection/records")"
  code="$(status "$response")"

  if [[ "$code" != 2* ]]; then
    echo "Create failed: collection=$collection HTTP=$code"
    body "$response"
    return 1
  fi
  body "$response"
}

record_id() {
  python3 -c 'import json,sys
print(json.load(sys.stdin)["id"])'
}

ADMIN_TOKEN="$(login users "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
ADMIN_ID="$(printf '%s' "$(api -H "Authorization: $ADMIN_TOKEN" "$BASE_URL/api/collections/users/records?filter=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("email=\\\"" + "'$ADMIN_EMAIL'" + "\\\""))')&perPage=1")" | body | record_id)"
roles=(manager finance sales programme_pic trainer viewer)

for role in "${roles[@]}"; do
  email="ci-${role}@example.com"
  payload="$(python3 - "$email" "$ROLE_PASSWORD" "$role" <<'PY'
import json,sys
email,password,role=sys.argv[1:]
print(json.dumps({
  "email": email,
  "password": password,
  "passwordConfirm": password,
  "name": f"CI {role}",
  "role": role,
  "team": "MASB_Team",
}))
PY
)"
  response="$(api -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "$payload" "$BASE_URL/api/collections/users/records")"
  code="$(status "$response")"
  if [[ "$code" != 2* ]]; then
    echo "Failed to provision role $role HTTP=$code"
    body "$response"
    exit 1
  fi
  body "$response" > "$TMP_DIR/$role.json"
done

role_id() {
  record_id < "$TMP_DIR/$1.json"
}

login_role() {
  login users "ci-$1@example.com" "$ROLE_PASSWORD"
}

for role in "${roles[@]}"; do
  token="$(login_role "$role")"
  id="$(role_id "$role")"
  response="$(api -H "Authorization: $token" "$BASE_URL/api/collections/users/records/$id")"
  if [[ "$(status "$response")" != "200" ]]; then
    echo "Role view failed: $role"
    body "$response"
    exit 1
  fi
  actual="$(body "$response" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("role",""))')"
  if [[ "$actual" != "$role" ]]; then
    echo "Role mismatch: expected=$role actual=$actual"
    exit 1
  fi
done

manager="$(login_role manager)"
viewer="$(login_role viewer)"
sales="$(login_role sales)"
finance="$(login_role finance)"
trainer="$(login_role trainer)"

expect_status 200 -H "Authorization: $manager" "$BASE_URL/api/collections/users/records?perPage=1"

viewer_response="$(api -H "Authorization: $viewer" "$BASE_URL/api/collections/users/records?perPage=1")"
if [[ "$(status "$viewer_response")" != "200" ]]; then
  echo 'Viewer list request failed'
  body "$viewer_response"
  exit 1
fi
viewer_total="$(body "$viewer_response" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("totalItems",-1))')"
if [[ "$viewer_total" != "0" ]]; then
  echo 'Viewer unexpectedly received user records'
  body "$viewer_response"
  exit 1
fi

sales_client_payload="$(python3 - "$ADMIN_ID" <<'PY'
import json,sys
print(json.dumps({"name":"CI Sales Client","status":"Active","createdBy":sys.argv[1]}))
PY
)"
expect_status 200 -X POST -H "Authorization: $sales" -H 'Content-Type: application/json' \
  -d "$sales_client_payload" "$BASE_URL/api/collections/clients/records"

expect_status 400 -X POST -H "Authorization: $viewer" -H 'Content-Type: application/json' \
  -d "$(python3 - "$ADMIN_ID" <<'PY'
import json,sys
print(json.dumps({"name":"CI Viewer Denied","status":"Active","createdBy":sys.argv[1]}))
PY
)" "$BASE_URL/api/collections/clients/records"

client_json="$(create_record "$manager" clients "$(python3 - "$ADMIN_ID" <<'PY'
import json,sys
print(json.dumps({"name":"CI Financial Client","status":"Active","createdBy":sys.argv[1]}))
PY
)")"
CID="$(printf '%s' "$client_json" | record_id)"

programme_json="$(create_record "$manager" programmes "$(python3 - "$CID" "$ADMIN_ID" <<'PY'
import json,sys
print(json.dumps({
  "client": sys.argv[1],
  "createdBy": sys.argv[2],
  "code": "CI-FIN-001",
  "title": "CI Financial Programme",
  "status": "Scheduled",
  "contractValue": 1000,
}))
PY
)")"
PID="$(printf '%s' "$programme_json" | record_id)"

expect_status 200 -X POST -H "Authorization: $trainer" -H 'Content-Type: application/json' \
  -d "$(python3 - "$PID" "$ADMIN_ID" <<'PY'
import json,sys
print(json.dumps({"programme":sys.argv[1],"createdBy":sys.argv[2],"title":"CI Trainer Session","status":"Scheduled"}))
PY
)" "$BASE_URL/api/collections/training_delivery/records"

expect_status 400 -X POST -H "Authorization: $viewer" -H 'Content-Type: application/json' \
  -d "$(python3 - "$PID" "$ADMIN_ID" <<'PY'
import json,sys
print(json.dumps({"programme":sys.argv[1],"createdBy":sys.argv[2],"title":"CI Viewer Session","status":"Scheduled"}))
PY
)" "$BASE_URL/api/collections/training_delivery/records"

invoice_json="$(create_record "$finance" invoices "$(python3 - "$PID" "$CID" "$ADMIN_ID" <<'PY'
import json,sys
programme,client,created_by=sys.argv[1:]
print(json.dumps({
  "programme": programme,
  "client": client,
  "createdBy": created_by,
  "invoiceNo": "CI-INV-001",
  "description": "CI integrity",
  "amount": 1000,
  "paidAmount": 0,
  "status": "Unpaid",
}))
PY
)")"
IID="$(printf '%s' "$invoice_json" | record_id)"

create_record "$finance" payments "$(python3 - "$IID" "$PID" "$CID" "$ADMIN_ID" <<'PY'
import json,sys
invoice,programme,client,created_by=sys.argv[1:]
print(json.dumps({
  "invoice": invoice,
  "programme": programme,
  "client": client,
  "createdBy": created_by,
  "paymentNo": "CI-PAY-001",
  "amount": 600,
  "method": "Bank Transfer",
  "status": "Completed",
}))
PY
)" >/dev/null

expect_status 400 -X POST -H "Authorization: $finance" -H 'Content-Type: application/json' \
  -d "$(python3 - "$IID" "$PID" "$CID" "$ADMIN_ID" <<'PY'
import json,sys
invoice,programme,client,created_by=sys.argv[1:]
print(json.dumps({
  "invoice": invoice,
  "programme": programme,
  "client": client,
  "createdBy": created_by,
  "paymentNo": "CI-PAY-002",
  "amount": 401,
  "method": "Bank Transfer",
  "status": "Completed",
}))
PY
)" "$BASE_URL/api/collections/payments/records"

expect_status 400 -X PATCH -H "Authorization: $finance" -H 'Content-Type: application/json' \
  -d '{"amount":500}' "$BASE_URL/api/collections/invoices/records/$IID"

echo 'Role provisioning, authorization and financial integrity E2E smoke tests passed.'
