# DELEGATION PROMPT — GPT (Round 1) — INSTRUCTIONS ARE IN THIS REPO

You are acting on behalf of the owner of **MIMOS Academy PMS V2**. Your job this round is
**ONE precise, verifiable deliverable**, then report back in the exact format at the bottom.
Do **not** improvise. Do **not** change schema/config/other files.

## Repo facts (already verified — trust these)

- Repo: `mimosacademy/mimos-academy-pms-v2`
- Branch (all work belongs here): **`arena/01a04d52-mimos-academy-pms-v2`**
- This instruction file lives in the repo at **`.handoff/GPT_PROMPT.md`** so you can read it.
- The workflow content to apply is at **`.handoff/quality.yml`** in this repo (119 lines,
  SHA256 `f569fd7918079add11054631ee52f30636ae3faf4491c96ae4e196a3bdcb6c98`).

## Why this is the deliverable

A `git push` was rejected:
```
refusing to allow a GitHub App to create or update workflow `.github/workflows/quality.yml`
without `workflows` permission
```
The connecting GitHub App token lacks the **`workflows`** scope. You (GPT) are used because
your environment has credentials with the **`workflows` Read & write** scope.

## Steps

1. Checkout the branch:
```bash
git fetch origin
git checkout arena/01a04d52-mimos-academy-pms-v2 \
  || git checkout -b arena/01a04d52-mimos-academy-pms-v2 origin/arena/01a04d52-mimos-academy-pms-v2
```

2. Verify the handoff file exists and its content (should print `f569fd...c98`):
```bash
sha256sum .handoff/quality.yml
```

3. Overwrite ONLY the workflow file with the handoff content:
```bash
cp .handoff/quality.yml .github/workflows/quality.yml
```

4. Confirm only ONE file changed:
```bash
git status --short
```
Must show **only** ` M .github/workflows/quality.yml`. If anything else, abort (`git checkout -- .`).

5. Commit (exact message):
```bash
git add .github/workflows/quality.yml
git commit -m "ci: add unit test and disposable migration/RLS validation jobs to quality gate"
```

6. Push:
```bash
git push origin arena/01a04d52-mimos-academy-pms-v2
```

7. Verify:
```bash
gh api repos/mimosacademy/mimos-academy-pms-v2/contents/.github/workflows/quality.yml?ref=arena/01a04d52-mimos-academy-pms-v2 --jq '.content' | base64 -d | grep -c "supabase/setup-cli"
git ls-remote --heads origin arena/01a04d52-mimos-academy-pms-v2
```
Expected: `1`, and the remote head advances past `d34147a`.

## Rules

- Do NOT modify `apps/web/.env`, `package.json`, or anything other than
  `.github/workflows/quality.yml`.
- Do NOT commit `node_modules/`, `dist/`, or ignored artifacts.
- Do NOT remove the `.handoff/` directory (the sysop will clean it up later).
- Do NOT open a PR, close issues, or force-push.
- If anything fails, STOP and report the exact error.

## REPORT BACK (fill and return verbatim)

```
ROUND 1 — WORKFLOW PUSH
auth_scopes_ok: yes/no
file_changed: <git status --short output>
commit_hash: <git rev-parse HEAD>
push_succeeded: yes/no
remote_head: <git ls-remote output>
verified_setup_cli_count: <number>
blocked_by_workflows_permission: yes/no
stderr_if_failed: <exact error or n/a>
anything_unexpected: <yes/no + note>
```
