#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${PB_BASE_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="${PB_BOOTSTRAP_USER_EMAIL:-ci-superadmin@example.com}"
ADMIN_PASSWORD="${PB_BOOTSTRAP_USER_PASSWORD:-CiApp-Password-2026-Strong!}"
TMP_DIR="${TMPDIR:-/tmp}/mimos-role-smoke"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT
api(){ curl -sS -w '\n%{http_code}' "$@"; }
status(){ printf '%s' "$1" | tail -n1; }
body(){ printf '%s' "$1" | sed '$d'; }
expect(){ local e="$1"; shift; local r s; r="$(api "$@")"; s="$(status "$r")"; [[ "$s" == "$e" ]] || { echo "Expected HTTP $e, got $s: $*"; printf '%s\n' "$r"; return 1; }; }
login(){ api -X POST -H 'Content-Type: application/json' -d "{\"identity\":\"$2\",\"password\":\"$3\"}" "$BASE_URL/api/collections/$1/auth-with-password" | sed '$d' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'; }
create(){
  local token="$1" collection="$2" payload="$3" response code
  response="$(api -X POST -H "Authorization: $token" -H 'Content-Type: application/json' -d "$payload" "$BASE_URL/api/collections/$collection/records")"
  code="$(status "$response")"
  if [[ "$code" != 2* ]]; then
    echo "Create failed: collection=$collection HTTP=$code"
    body "$response"
    return 1
  fi
  body "$response"
}
ADMIN_TOKEN="$(login users "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
roles=(manager finance sales programme_pic trainer viewer)
for role in "${roles[@]}"; do
  email="ci-${role}@example.com"; pw='CiRole-Password-2026-Strong!'
  if ! curl -sS -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$pw\",\"passwordConfirm\":\"$pw\",\"name\":\"CI ${role}\",\"role\":\"$role\",\"verified\":true}" "$BASE_URL/api/collections/users/records" > "$TMP_DIR/$role.json"; then
    echo "Failed to provision role $role"; cat "$TMP_DIR/$role.json"; exit 1
  fi
done
role_id(){ python3 - "$TMP_DIR/$1.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))['id'])
PY
}
login_role(){ login users "ci-$1@example.com" 'CiRole-Password-2026-Strong!'; }
for role in "${roles[@]}"; do
  token="$(login_role "$role")"; id="$(role_id "$role")"; r="$(api -H "Authorization: $token" "$BASE_URL/api/collections/users/records/$id")"
  [[ "$(status "$r")" == 200 ]] || exit 1
  actual="$(body "$r" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("role",""))')"
  [[ "$actual" == "$role" ]] || { echo "Role mismatch: $role != $actual"; exit 1; }
done
manager="$(login_role manager)"; viewer="$(login_role viewer)"; sales="$(login_role sales)"; finance="$(login_role finance)"; trainer="$(login_role trainer)"
expect 200 -H "Authorization: $manager" "$BASE_URL/api/collections/users/records?perPage=1"
r="$(api -H "Authorization: $viewer" "$BASE_URL/api/collections/users/records?perPage=1")"; [[ "$(status "$r")" == 200 ]] || exit 1
[[ "$(body "$r" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("totalItems",-1))')" == 0 ]] || exit 1
SALES_ID="$(role_id sales)"; MANAGER_ID="$(role_id manager)"; FINANCE_ID="$(role_id finance)"
expect 200 -X POST -H "Authorization: $sales" -H 'Content-Type: application/json' -d "{\"name\":\"CI Sales Client\",\"status\":\"Active\",\"createdBy\":\"$SALES_ID\"}" "$BASE_URL/api/collections/clients/records"
expect 400 -X POST -H "Authorization: $viewer" -H 'Content-Type: application/json' -d "{\"name\":\"CI Viewer Denied\",\"status\":\"Active\",\"createdBy\":\"$SALES_ID\"}" "$BASE_URL/api/collections/clients/records"
CJSON="$(create "$manager" clients "{\"name\":\"CI Financial Client\",\"status\":\"Active\",\"createdBy\":\"$MANAGER_ID\"}")"; CID="$(printf '%s' "$CJSON"|python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"
PJSON="$(create "$manager" programmes "{\"client\":\"$CID\",\"code\":\"CI-FIN-001\",\"title\":\"CI Financial Programme\",\"status\":\"Scheduled\",\"contractValue\":1000,\"createdBy\":\"$MANAGER_ID\"}")"; PID="$(printf '%s' "$PJSON"|python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"
expect 200 -X POST -H "Authorization: $trainer" -H 'Content-Type: application/json' -d "{\"programme\":\"$PID\",\"title\":\"CI Trainer Session\",\"status\":\"Scheduled\",\"createdBy\":\"$MANAGER_ID\"}" "$BASE_URL/api/collections/training_delivery/records"
expect 400 -X POST -H "Authorization: $viewer" -H 'Content-Type: application/json' -d "{\"programme\":\"$PID\",\"title\":\"CI Viewer Session\",\"status\":\"Scheduled\",\"createdBy\":\"$MANAGER_ID\"}" "$BASE_URL/api/collections/training_delivery/records"
IJSON="$(create "$finance" invoices "{\"programme\":\"$PID\",\"client\":\"$CID\",\"invoiceNo\":\"CI-INV-001\",\"description\":\"CI integrity\",\"amount\":1000,\"paidAmount\":0,\"status\":\"Unpaid\",\"createdBy\":\"$FINANCE_ID\"}")"; IID="$(printf '%s' "$IJSON"|python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"
create "$finance" payments "{\"invoice\":\"$IID\",\"programme\":\"$PID\",\"client\":\"$CID\",\"paymentNo\":\"CI-PAY-001\",\"amount\":600,\"method\":\"Bank Transfer\",\"status\":\"Completed\",\"createdBy\":\"$FINANCE_ID\"}" >/dev/null
expect 400 -X POST -H "Authorization: $finance" -H 'Content-Type: application/json' -d "{\"invoice\":\"$IID\",\"programme\":\"$PID\",\"client\":\"$CID\",\"paymentNo\":\"CI-PAY-002\",\"amount\":401,\"method\":\"Bank Transfer\",\"status\":\"Completed\",\"createdBy\":\"$FINANCE_ID\"}" "$BASE_URL/api/collections/payments/records"
expect 400 -X PATCH -H "Authorization: $finance" -H 'Content-Type: application/json' -d '{"amount":500}' "$BASE_URL/api/collections/invoices/records/$IID"
echo 'Role provisioning, authorization and financial integrity E2E smoke tests passed.'
