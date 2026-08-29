# Ideas incorporated from GitHub repositories & upstream guidance

This session incorporated patterns from open-source repos and official Supabase/Vercel
guidance. The references below are the sources; the "Applied here" column maps each idea to
the concrete change made in this repository.

## Deploying Supabase + Vercel full-stack apps

| Source | Idea | Applied here |
| --- | --- | --- |
| [Razikus/supabase-nextjs-template](https://github.com/Razikus/supabase-nextjs-template) | Keep the public `NEXT_PUBLIC_SUPABASE_URL`/anon key for the browser and the `service_role` key server-side only; configure `site_url` and `additional_redirect_urls` in `supabase/config.toml` for auth redirects. | `supabase/config.toml` sets `site_url` and `additional_redirect_urls` for local auth redirects; `apps/web/src/lib/supabaseClient.js` uses only the publishable key; staff provisioning (`tools/supabase/provision-staff.mjs`) requires the service-role key at runtime only. |
| Supabase docs — [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) & [CLI reference](https://supabase.com/docs/reference/cli/supabase-migration) | Migrations are forward-only via files; validate with `supabase db reset` before `supabase db push`; run a full reset in a disposable env in CI. | Added `supabase/config.toml`, `scripts/db-regression.sh` (reset + apply + regression), and a `supabase-migrations` CI job that boots a disposable stack. |
| [supabase/agent-skills — RLS basics](https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/references/security-rls-basics.md) | Enable and **force** RLS; rely on database-enforced rules, not application-level filtering. | The repo already does this (RLS on all app tables + `FORCE ROW LEVEL SECURITY` where relevant). Documented as the security boundary in `README.md`. |

## Security headers & CSP on Vercel

| Source | Idea | Applied here |
| --- | --- | --- |
| [zeriflow Vercel security headers guide](https://zeriflow.com/blog/vercel-security-headers-guide) and [Hardening a Vercel app (dev.to)](https://dev.to/pocketportfolio/hardening-a-vercel-app-csp-cors-and-service-workers-that-dont-bite-1k2m) | Set CSP, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` in `vercel.json`; cache immutable assets long-term and never cache `/api/*`; don't rely on Vercel auto-adding headers. | `apps/web/vercel.json` now sets the full set of security headers, `frame-ancestors 'none'`, and `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`. |
| [safetoship.dev — Missing CSP header on Vercel](https://safetoship.dev/fix/missing-csp-header/on/vercel) | Start CSP permissively; allow same-origin scripts/styles plus any CDNs you actually use; block framing. | CSP allows `'self'` scripts, inline styles (Tailwind/shadcn), `https://*.supabase.co` for API/realtime, `img-src` https/data/blob, and `frame-ancestors 'none'`. |

## Row-Level Security & Supabase security

| Source | Idea | Applied here |
| --- | --- | --- |
| [Supabase RLS guide (designrevision.com)](https://designrevision.com/blog/supabase-row-level-security) & [pentestly.io Supabase audit lessons](https://www.pentestly.io/blog/supabase-security-best-practices-2025-guide) | Use `USING` for SELECT and `WITH CHECK` for writes; avoid `FOR ALL` catch-all policies; deny-by-default; anchor Storage policies to tenant/programme identifiers in the object key; keep helper functions private. | Already enforced in migrations (`011_rls.sql`, `016_*`, `017_*`, `020_*`, `044_*`): per-command policies, `pms_documents_*` Storage policies anchored to `programmes/{programme_id}/...`, private-schema authorization helpers, no `USING (true)` on sensitive tables. |

## Frontend build & performance (Vite/React)

| Source | Idea | Applied here |
| --- | --- | --- |
| Vite docs — [manualChunks / code splitting](https://vite.dev/guide/build.html#chunk-splitting-guide) | Split vendor groups and lazy-load routes so the initial script stays small and vendors are cached independently. | `apps/web/src/App.jsx` uses `React.lazy` per route; `vite.config.js` uses `manualChunks` for `vendor-react`, `vendor-supabase`, `vendor-charts`, `vendor-ui`. Entry dropped 1,174 kB → 174 kB. |

## Testing & CI

| Source | Idea | Applied here |
| --- | --- | --- |
| Supabase CLI — `supabase test db` / pgtap | Run regression SQL against a disposable database. | Wired a disposable-env job (`supabase-migrations`) using the Supabase CLI action + `scripts/db-regression.sh`. (Converting the checks to pgTAP is on the roadmap.) |
| Vitest | Add a fast unit-test layer for pure logic. | Added `vitest.config.js` + 13 tests for the role matrix and exact-decimal math. |

## Candidate ideas queued (not yet applied)

See `docs/DEVELOPMENT_PLAN.md` Phase 4:
- Asymmetric JWT signing (RS256/ES256) and MFA for privileged roles (from the audit guidance).
- Strict CORS allowlists + caller-JWT forwarding for Edge Functions (so RLS still applies).
- Virus-scan / malware hook on Storage uploads.
- Convert the read-only SQL checks to pgTAP so `supabase test db` is the single test entry point.
