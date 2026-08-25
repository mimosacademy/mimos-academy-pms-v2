#!/usr/bin/env node

/**
 * Production-safe staff provisioning helper.
 *
 * Required environment variables:
 *   PB_URL                  PocketBase URL, e.g. https://pms.example.com
 *   PB_ADMIN_EMAIL          PocketBase superuser email
 *   PB_ADMIN_PASSWORD       PocketBase superuser password
 *   PB_STAFF_SEED_JSON      JSON array of {name,email,password?,role?,team}
 *
 * Production credentials are intentionally not stored in Git.
 * If role is omitted for a new user, one of the six non-admin roles is
 * assigned randomly. Existing users keep their current role unless a role
 * is explicitly supplied. This gives the initial deployment a temporary
 * permission distribution that the Super Admin can correct later.
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
const randomRoles = ["manager", "finance", "sales", "programme_pic", "trainer", "viewer"];

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

function randomRole() {
  return randomRoles[Math.floor(Math.random() * randomRoles.length)];
}

const admin = await request("/api/collections/_superusers/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD }),
});
const auth = { Authorization: admin.token };

for (const user of staff) {
  if (!user?.name || !user?.email || !user?.team) {
    throw new Error("Each staff record requires name, email and team");
  }

  const encoded = encodeURIComponent(`email = '${String(user.email).replace(/'/g, "\\'")}'`);
  const existing = await request(`/api/collections/users/records?filter=${encoded}&perPage=1`, { headers: auth });
  const existingUser = existing.items?.[0];
  const role = user.role || existingUser?.role || randomRole();

  if (!allowedRoles.has(role)) throw new Error(`Unsupported role for ${user.email}: ${role}`);

  const payload = {
    name: user.name,
    email: user.email,
    role,
    team: user.team,
  };
  if (user.password) {
    payload.password = user.password;
    payload.passwordConfirm = user.password;
  }

  if (existingUser) {
    await request(`/api/collections/users/records/${existingUser.id}`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify(payload),
    });
    console.log(`updated ${user.email} (${role})`);
  } else {
    if (!user.password) throw new Error(`Password is required when creating ${user.email}`);
    await request("/api/collections/users/records", {
      method: "POST",
      headers: auth,
      body: JSON.stringify(payload),
    });
    console.log(`created ${user.email} (${role})`);
  }
}

console.log(`Provisioned ${staff.length} staff account(s).`);
