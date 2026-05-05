#!/usr/bin/env python3
"""Audit simulations in master_simulations against the schemas the React
renderers actually understand.

Why this exists
---------------
React side renders each sim_type with a dedicated component:
  • DecisionMakingSim.jsx → expects config.decision_points + config.scoring
  • DocumentSim.jsx       → expects config.document_data + config.tasks
  • ExcelSim.jsx          → expects config.tasks
  • InteractiveSim.jsx    → expects config.exercise_type
If any of these are missing, the sim falls through to GenericRenderer and the
user sees an "incomplete" simulation. We've also accumulated a handful of
LEGACY keys (`rounds`, `scoring_rubric`, `simulation_structure`, `design_theme`,
`modules`) that mark a sim as having a pre-renderer config that nothing handles.

This script is the pre-deploy gate. It exits non-zero if any sim in the audited
scope is broken, so CI fails before the change reaches production.

Configuration
-------------
SUPABASE_URL              required — e.g. https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY required — bypasses RLS to read every sim

CLI
---
  python3 audit_simulations.py                    # audit ALL modules (strict)
  python3 audit_simulations.py --modules 1        # audit only Module 1
  python3 audit_simulations.py --modules 1,2,7    # audit Modules 1, 2 and 7
  python3 audit_simulations.py --allow-missing    # don't fail on sessions without sims
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

LEGACY_KEYS = {
    "rounds",
    "scoring_rubric",
    "simulation_structure",
    "design_theme",
    "modules",
}

REQUIRED = {
    "decision_making": {"decision_points", "scoring"},
    "document": {"document_data", "tasks"},
    "excel": {"tasks"},
    "interactive": {"exercise_type"},
}


def env(name):
    v = os.environ.get(name)
    if not v:
        sys.stderr.write(
            f"ERROR: ${name} is required. Set it in CI secrets or your local .env.\n"
        )
        sys.exit(2)
    return v


def req(supabase_url, sr_key, path):
    url = f"{supabase_url.rstrip('/')}/rest/v1/{path}"
    r = urllib.request.Request(
        url,
        headers={"apikey": sr_key, "Authorization": f"Bearer {sr_key}"},
    )
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"HTTP {e.code} {url}\n  body: {e.read().decode()[:300]}\n")
        raise


def diagnose(sim):
    cfg = sim.get("config") or {}
    keys = set(cfg.keys())
    legacy = keys & LEGACY_KEYS
    if legacy:
        return f"LEGACY keys present: {sorted(legacy)}"
    required = REQUIRED.get(sim["sim_type"])
    if required and not required.issubset(keys):
        return f"missing required keys for {sim['sim_type']}: {sorted(required - keys)}"
    return None


def parse_modules_arg(arg):
    if not arg:
        return None
    return {int(x.strip()) for x in arg.split(",") if x.strip()}


def audit(supabase_url, sr_key, module_filter, allow_missing):
    modules = req(
        supabase_url, sr_key,
        "master_modules?select=id,title,order_index&order=order_index",
    )
    if module_filter is not None:
        modules = [m for m in modules if m["order_index"] in module_filter]
        if not modules:
            sys.stderr.write(
                f"ERROR: no modules matched filter {sorted(module_filter)}\n"
            )
            sys.exit(2)

    ok = broken = missing = 0
    for m in modules:
        print(f"\n=== Module {m['order_index']} — {m['title'][:60]} ===")
        sessions = req(
            supabase_url, sr_key,
            f"master_sessions?module_id=eq.{m['id']}"
            "&select=id,title,order_index&order=order_index",
        )
        for s in sessions:
            sims = req(
                supabase_url, sr_key,
                f"master_simulations?session_id=eq.{s['id']}"
                "&select=id,sim_type,title,config",
            )
            if not sims:
                missing += 1
                marker = "?" if allow_missing else "✗"
                print(f"  {marker} S{s['order_index']:>2} (no sim) {s['title'][:55]}")
                continue
            for sim in sims:
                d = diagnose(sim)
                marker = "✗" if d else "✓"
                print(
                    f"  {marker} S{s['order_index']:>2} {sim['sim_type']:<15}"
                    f" {sim['id'][:8]} | {s['title'][:50]}"
                )
                if d:
                    print(f"        ↳ {d}")
                    broken += 1
                else:
                    ok += 1

    print("\n=== Summary ===")
    print(f"  OK:      {ok}")
    print(f"  BROKEN:  {broken}")
    print(f"  MISSING: {missing} ({'allowed' if allow_missing else 'blocking'})")

    fail = broken > 0 or (missing > 0 and not allow_missing)
    return 0 if not fail else 1


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__.strip())
    p.add_argument(
        "--modules",
        type=str,
        default=None,
        help="Comma-separated module order_index values to audit (default: all)",
    )
    p.add_argument(
        "--allow-missing",
        action="store_true",
        help="Don't fail when a session has zero sims (useful for un-built modules)",
    )
    args = p.parse_args()

    code = audit(
        supabase_url=env("SUPABASE_URL"),
        sr_key=env("SUPABASE_SERVICE_ROLE_KEY"),
        module_filter=parse_modules_arg(args.modules),
        allow_missing=args.allow_missing,
    )
    sys.exit(code)
