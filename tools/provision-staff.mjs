#!/usr/bin/env node

/**
 * Production-safe staff provisioning helper.
 *
 * Required environment variables:
 *   PB_URL                  PocketBase URL, e.g. https://pms.example.com
 *   PB_ADMIN_EMAIL          PocketBase superuser email
 *   PB_ADMIN_PASSWORD       PocketBase superuser password
 *   PB_STAFF_SEED_JSON      JSON array of {name,email,password,role,team}
 *
 * No production credentials are stored in Git. The caller supplies them through
 * an external secret manager / deployment environment.
 *
 * Existing users are updated for name/team/role but their password is changed
 * only when explicitly supplied in the seed object. The script is idempotent.
 */

const required = ["PB_URL", "PB_ADMIN_EMAIL", "PB_ADMIN_PASSWORD", "PB_STAFF_SEED_JSON"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const allowedRoles = new Set([
  "manager",
  "finance",
  "sales",
  "programme_pic",
  "trainer",
  "viewer",
  "super_admin",
]);

const staff = JSON.parse(process.env.PB_STAFF_SEED_JSON);
if (!Array.isArray(staff)) throw new Error("PB_STAFF_SEED_JSON must be a JSON array");

const base = process.env.PB_URL.replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

const admin = await request("/api/collections/_superusers/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD }),
});
const auth = { Authorization: admin.token };

for (const user of staff) {
  if (!user?.name || !user?.email || !user?.role || !user?.team) {
    throw new Error("Each staff record requires name, email, role and team");
  }
  if (!allowedRoles.has(user.role)) throw new Error(`Unsupported role for ${user.email}: ${user.role}`);
  if (user.role === "super_admin" && user.team !== "MASB_Team") {
    throw new Error(`Unexpected team for super_admin: ${user.email}`);
  }

  const encoded = encodeURIComponent(`email = '${String(user.email).replace(/'/g, "\\'")}'`);
  const existing = await request(`/api/collections/users/records?filter=${encoded}&perPage=1`, { headers: auth });

  const payload = {
    name: user.name,
    email: user.email,
    role: user.role,
    team: user.team,
  };
  if (user.password) {
    payload.password = user.password;
    payload.passwordConfirm = user.password;
  }

  if (existing.items?.length) {
    const id = existing.items[0].id;
    await request(`/api/collections/users/records/${id}`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify(payload),
    });
    console.log(`updated ${user.email} (${user.role})`);
  } else {
    if (!user.password) throw new Error(`Password is required when creating ${user.email}`);
    await request("/api/collections/users/records", {
      method: "POST",
      headers: auth,
      body: JSON.stringify(payload),
    });
    console.log(`created ${user.email} (${user.role})`);
  }
}

console.log(`Provisioned ${staff.length} staff account(s).`);
