#!/usr/bin/env python3
"""Audit all simulations across all modules for legacy/broken schemas
that would fall through to GenericRenderer instead of rendering with the
proper sim_type-specific renderer.

Usage:
  python3 /app/scripts/audit_simulations.py            # full audit
  python3 /app/scripts/audit_simulations.py --module 1 # audit a single module
"""
import argparse, json, sys, urllib.request

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

# Markers that indicate a legacy schema that no renderer in
# /app/frontend/src/components/simulations/ supports natively. Any of these
# means the sim falls through to GenericRenderer.
LEGACY_KEYS = {
    "rounds",
    "scoring_rubric",
    "simulation_structure",
    "design_theme",
    "modules",  # old slider_interactive shape
}

# Required keys per sim_type, mirroring the actual renderer expectations:
#   DecisionMakingSim.jsx  → decision_points + scoring
#   DocumentSim.jsx        → document_data + tasks
#   ExcelSim.jsx           → tasks (cells/data shape varies)
#   InteractiveSim.jsx     → exercise_type + items
REQUIRED = {
    "decision_making": {"decision_points", "scoring"},
    "document": {"document_data", "tasks"},
    "excel": {"tasks"},
    "interactive": {"exercise_type"},
}


def req(path):
    r = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SR, "Authorization": f"Bearer {SR}"},
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode())


def diagnose(sim):
    cfg = sim.get("config") or {}
    keys = set(cfg.keys())
    st = sim["sim_type"]

    legacy_present = keys & LEGACY_KEYS
    if legacy_present:
        return f"LEGACY keys present: {sorted(legacy_present)}"

    required = REQUIRED.get(st)
    if required and not required.issubset(keys):
        missing = required - keys
        return f"missing required keys for {st}: {sorted(missing)}"

    return None


def audit(module_filter=None):
    modules = req("master_modules?select=id,title,order_index&order=order_index")
    if module_filter is not None:
        modules = [m for m in modules if m["order_index"] == module_filter]

    grand_ok, grand_broken, grand_missing = 0, 0, 0
    for m in modules:
        print(f"\n=== Module {m['order_index']} — {m['title'][:60]} ===")
        sessions = req(
            f"master_sessions?module_id=eq.{m['id']}"
            "&select=id,title,order_index&order=order_index"
        )
        for s in sessions:
            sims = req(
                f"master_simulations?session_id=eq.{s['id']}"
                "&select=id,sim_type,title,config"
            )
            if not sims:
                grand_missing += 1
                print(
                    f"  ? S{s['order_index']:>2} (no sim) {s['title'][:55]}"
                )
                continue
            for sim in sims:
                diag = diagnose(sim)
                marker = "✗" if diag else "✓"
                print(
                    f"  {marker} S{s['order_index']:>2} {sim['sim_type']:<15}"
                    f" {sim['id'][:8]} | {s['title'][:50]}"
                )
                if diag:
                    print(f"        ↳ {diag}")
                    grand_broken += 1
                else:
                    grand_ok += 1

    print(
        f"\n=== Summary ===\n  OK:      {grand_ok}\n"
        f"  BROKEN:  {grand_broken}\n  MISSING: {grand_missing}"
    )
    return grand_broken == 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--module", type=int, help="Audit only a single module (by order_index)")
    args = p.parse_args()
    ok = audit(args.module)
    sys.exit(0 if ok else 1)
