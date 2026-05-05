# GitHub Actions — Simulation Audit Gate

This workflow runs on every push and PR to `main` and on manual dispatch from
the **Actions** tab. It enforces that every simulation in `master_simulations`
matches the schema the React renderers actually understand.

## Setup (one-time)

In the GitHub repo, go to **Settings → Secrets and variables → Actions → New
repository secret** and add:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | `https://yuadeybycbfqlkdpxbkv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` key from `/app/backend/.env` |

The service role key bypasses RLS for read access — strictly required because
the audit reads `master_*` tables which are RLS-protected.

> ⚠️ Do **not** commit the service role key. It only ever lives in `backend/.env`
> (gitignored) and in GitHub Actions secrets.

## What gets gated

There are two jobs in `audit-simulations.yml`:

| Job | Behaviour | When it fails |
| --- | --- | --- |
| `audit-strict` | **Blocks the build** | Any sim in the strict-audit modules has a broken/legacy config |
| `audit-advisory` | Informational only (`continue-on-error`) | Never |

The strict job currently audits **only Module 1** (the only fully-cleaned
module). To extend the gate as more modules are cleaned up, edit the
`--modules` flag inside `.github/workflows/audit-simulations.yml`:

```yaml
# strict job, run step
python3 scripts/audit_simulations.py --modules 1,2,7   # add modules here
```

## Local dry-run

You can run the same audit locally before pushing:

```bash
export SUPABASE_URL="https://yuadeybycbfqlkdpxbkv.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"

# Same gate the strict CI job runs
python3 scripts/audit_simulations.py --modules 1

# Full-platform visibility (won't fail on missing sims)
python3 scripts/audit_simulations.py --allow-missing
```

Exit codes:
- `0` – all audited sims pass
- `1` – at least one broken sim (or missing sim when `--allow-missing` is off)
- `2` – missing required env vars
