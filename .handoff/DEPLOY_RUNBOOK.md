# DEPLOY RUNBOOK (manual) — MIMOS Academy PMS V2

Jika GPT tidak boleh akses Supabase/Vercel CLI, ikut ini secara manual. Semua langkah di
atas boleh dilakukan oleh seorang operator dengan akses dashboard. **Jangan simpan
kredensial dalam fail ini atau dalam chat.**

> Prinsip: `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` sahaja dalam Vercel browser
> env. Service-role key & DB password HANYA di side server/CLI. Lihat `docs/ENVIRONMENT.md`.

---

## 1. Supabase project

1. Buka [supabase.com](https://supabase.com), buka/lengkapi projek yang telah ada
   (ref `sduudaavhlpgrxpqwahc`) atau cipta projek baharu khusus (`mimos-academy-pms`), region
   terdekat.
2. **Auth settings:** enable Email auth + email confirmation. Set **Site URL** dan tambah
   **Redirect URLs** untuk domain Vercel akhir (cth `https://pms.mimos-academy.com/**`) dan
   `https://localhost:3000/**` untuk dev.

## 2. Apply migrations

> **PENTING — jangan guna `supabase db push` untuk repo ini.**
> Fail migration di repo guna prefix 3-digit (`001_...`–`048_...`), manakala Supabase CLI
> merekod versi dalam format timestamp (cth `20260827033124`). Perbezaan format ini membuatkan
> CLI **tidak dapat menyelaraskannya** dengan betul. Oleh itu, guna **runner deterministik**
> atau **SQL Editor mengikut urutan**.

### Pilihan A — Runner deterministik (disyorkan)
```bash
# salin fail migration mengikut urutan (bukan CLI renumbering)
SUPABASE_DB_URL="postgresql://..." scripts/apply-migrations.sh
```
- `scripts/apply-migrations.sh` menerapkan **45** fail dalam urutan nama, `ON_ERROR_STOP=1`
  (berhenti pada ralat pertama).
- `scripts/migration-order.txt` = senarai 45 fail dalam urutan tepat.
- `scripts/migration-checksums.txt` = SHA-256 setiap fail (untuk pengesahan integriti).
- Untuk juga menjalankan regression checks selepas itu: `RUN_REGRESSION=1 SUPABASE_DB_URL=... scripts/apply-migrations.sh`.

### Pilihan B — SQL Editor (manual)
Buka `.handoff/DEPLOY_RUNBOOK.md` → bahagian `scripts/apply-migrations.sql` untuk senarai
urutan penuh, dan jalankan setiap fail di sebaliknya satu per satu dalam urutan itu. Berhenti
pada ralat pertama.

> Jangan ubah fail migration yang telah diguna; bina migration baharu untuk perubahan.

Sesudah migrate, jalankan read-only checks di `supabase/tests/*.sql` (11 fail) dan sahkan
**45** migration diterapkan.

## 3. Storage bucket

- Buat bucket **private** bernama `pms-documents`.
- Policy bagi programme-scoped access disediakan oleh migration RLS (`012_storage.sql`,
  `016_security_integrity_hardening.sql`). Sahkan ia wujud.

## 4. Edge Functions

- Deploy setiap fungsi:
  ```bash
  supabase functions deploy admin-invite-user
  supabase functions deploy admin-list-users
  supabase functions deploy admin-user-action
  supabase functions deploy data-intake-analyze
  supabase functions deploy data-intake-compare
  supabase functions deploy data-intake-ingest
  supabase functions deploy data-intake-promote
  ```
- Jangan letakkan `service_role` sebagai default; forward caller JWT.

## 5. Provision staff & roles

Server-side sahaja (perlukan service-role key dari env):

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<from env / password manager>" \
SUPABASE_INVITE_REDIRECT_URL="https://<your-vercel-domain>" \
node tools/supabase/provision-staff.mjs
```

Sahkan setiap user ada baris aktif dalam `public.staff` + `staff_role` sah.

## 6. Vercel deploy (frontend)

1. Vercel → **New Project** → import repo `mimosacademy/mimos-academy-pms-v2`.
2. **Root Directory:** `apps/web`, **Framework Preset:** Vite.
3. **Install:** `npm ci`, **Build:** `npm run build`, **Output:** `dist`.
4. **Environment variables** (browser):
   - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
5. Deploy → tunggu **READY**.
6. **Custom domain:** di Hostinger, set DNS record mengikut arahan Vercel. Sahkan domain
   akhir aktif.

## 7. Smoke test (per docs/PRODUCTION_READINESS §13)

- Login (Super Admin, Manager, Finance, Sales, PIC, Trainer, Viewer).
- Viewer direct invoice/payment access = ditolak.
- PIC cross-programme = ditolak.
- Payment sah berjaya; overpayment ditolak server-side; duplicate `operation_id` ditolak.
- Upload/download dokumen programme berlaku hanya untuk programme yang dibenarkan.
- Dashboard & route kritikal berfungsi.

## Audit akhir

- `npm run verify` lulus (lint + test + build).
- TIADA service-role key dalam `apps/web/src`, dalam Vercel browser env, atau dalam repo.
- Supabase security advisors bersih; backup/DR diuji (restore drill).
