# DELEGATION PROMPT — GPT (Round 3b) — PUSH CI WORKFLOW FIX

You are relaying for the owner of **MIMOS Academy PMS V2** (relay mode). Your job is ONE
verifiable deliverable, then report back. Do **not** improvise, do **not** fabricate output,
do **not** leak secrets.

## Repo context (verified)

- Repo: `mimosacademy/mimos-academy-pms-v2`
- Branch (all work belongs here): **`arena/01a04d52-mimos-academy-pms-v2`**
- A PR was opened (#17) from this branch → `main`. Its CI run **failed** on two jobs:
  - **`deployment-config-check`** — a grep pattern in `quality.yml` matched a legitimate
    line in `docs/DEPLOYMENT.md` ("retired VPS/systemd/nginx/backup files").
  - **`supabase-migrations`** — `supabase start` failed (Step 5), almost certainly because
    Docker is not available on the GitHub runner.
- The fixes are already made in the working tree of the repo. The updated workflow file is
  available in-repo at **`.handoff/quality.yml`** in this same branch (SHA256
  `9d056d710798a1526a8e5f47e879a84e6b760750d0c2328a1a7e6fd4827d973c`).

## Why you (not the sysop)

The sysop's GitHub token lacks the **`workflows`** write scope, so it cannot update
`.github/workflows/quality.yml`. Your credentials do. (This is the same split as Round 1.)

## Steps

1. Check the branch:
```bash
git fetch origin
git checkout arena/01a04d52-mimos-academy-pms-v2 \
  || git checkout -b arena/01a04d52-mimos-academy-pms-v2 origin/arena/01a04d52-mimos-academy-pms-v2
```

2. Verify the provided workflow file matches what must be committed:
```bash
sha256sum .handoff/quality.yml
```
Expected: `9d056d710798a1526a8e5f47e879a84e6b760750d0c2328a1a7e6fd4827d973c`

3. Overwrite ONLY the workflow file:
```bash
cp .handoff/quality.yml .github/workflows/quality.yml
```

4. Confirm only ONE file changed:
```bash
git status --short
```
Must show **only** ` M .github/workflows/quality.yml`. If anything else appears, abort
(`git checkout -- .`).

5. Commit (exact message):
```bash
git add .github/workflows/quality.yml
git commit -m "ci: fix deployment-config-check grep and skip supabase-migrations when Docker is unavailable"
```

6. Push:
```bash
git push origin arena/01a04d52-mimos-academy-pms-v2
```

7. Verify the push landed (expected output `1`):
```bash
gh api repos/mimosacademy/mimos-academy-pms-v2/contents/.github/workflows/quality.yml?ref=arena/01a04d52-mimos-academy-pms-v2 --jq '.content' | base64 -d | grep -c "SKIPPED_DOCKER_UNAVAILABLE"
```
Also confirm remote head advanced:
```bash
git ls-remote --heads origin arena/01a04d52-mimos-academy-pms-v2
```

## Rules

- Do **NOT** modify `apps/web/.env`, `package.json`, `scripts/`, `docs/`, `.handoff/`, or any
  file other than `.github/workflows/quality.yml`.
- Do **NOT** close the PR, do **NOT** force-push, do **NOT** merge.
- Do **NOT** remove `.handoff/` (the sysop manages it).
- If push is rejected with `without 'workflows' permission`, STOP and report it — do not
  work around it.

## REPORT BACK (fill + return verbatim)

```
ROUND 3b — CI WORKFLOW FIX PUSH
file_changed: <git status --short>
commit_hash: <git rev-parse HEAD>
push_succeeded: yes/no
remote_head: <git ls-remote>
verified_guard_count: <grep -c SKIPPED_DOCKER_UNAVAILABLE>
blocked_by_workflows_permission: yes/no
stderr_if_failed: <exact or n/a>
secrets_exposed: no
anything_unexpected: <yes/no + note>
```
