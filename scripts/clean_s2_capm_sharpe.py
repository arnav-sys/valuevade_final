#!/usr/bin/env python3
"""
S2 (Risk & Return Fundamentals) content fixes:
  1. Delete all CAPM and Sharpe ratio questions from master_quiz_questions
  2. Delete all CAPM and Sharpe ratio questions from master_interview_questions

Aligns with PRD Phase 17/23: S2 notes were trimmed to cover only HPR, E(R),
and σ — no Sharpe, no CAPM. Quiz + interview pools needed to follow.
"""
import json, sys, urllib.request, urllib.error

SUPABASE_URL = "https://yuadeybycbfqlkdpxbkv.supabase.co"
SR = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YWRleWJ5Y2JmcWxrZHB4Ymt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkxMjA0MywiZXhwIjoyMDkxNDg4MDQzfQ.43zmWnb2ipn_mmYHAjVZZsFUZTyy_lb71T9ZqGyMxak"

S2_SESSION = "081d48c1-4ce7-4fec-b8df-de49a8cdc0ab"

# IDs confirmed from live DB inspection
QUIZ_IDS_TO_DELETE = [
    "28db646d",  # [4] Sharpe ratio compute
    "3b7025ad",  # [5] CAPM cost of equity
    "9324ba6e",  # [8] Sharpe ratio = 0 meaning
]
INTERVIEW_IDS_TO_DELETE = [
    "5e94a4ac",  # [2] CAPM walk-through Infosys
    "5c2f026d",  # [4] Sharpe ratio + beta
    "328f41c3",  # [5] Sharpe ratio comparison
    "556dbb40",  # [6] CAPM uses beta
]


def req(method, path, want_json=True):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    r = urllib.request.Request(url, method=method, headers={
        "apikey": SR, "Authorization": f"Bearer {SR}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(r) as resp:
            text = resp.read().decode()
            return json.loads(text) if want_json and text else text
    except urllib.error.HTTPError as e:
        print("ERR:", e.read().decode()); raise


def main():
    # Fetch current state
    quizzes = req("GET",
        f"master_quiz_questions?session_id=eq.{S2_SESSION}&select=id,question,order_index&order=order_index")
    interviews = req("GET",
        f"master_interview_questions?session_id=eq.{S2_SESSION}&select=id,question,order_index&order=order_index")

    def find_full_id(short, pool):
        return next((x["id"] for x in pool if x["id"].startswith(short)), None)

    print("=== QUIZ deletions ===")
    for short in QUIZ_IDS_TO_DELETE:
        full = find_full_id(short, quizzes)
        if not full:
            print(f"  ⚠ {short}: not found"); continue
        q = next(x for x in quizzes if x["id"] == full)
        print(f"  DELETE [{q['order_index']}] {full[:8]} | {q['question'][:80]}")
        req("DELETE", f"master_quiz_questions?id=eq.{full}", want_json=False)

    print("\n=== INTERVIEW deletions ===")
    for short in INTERVIEW_IDS_TO_DELETE:
        full = find_full_id(short, interviews)
        if not full:
            print(f"  ⚠ {short}: not found"); continue
        iv = next(x for x in interviews if x["id"] == full)
        print(f"  DELETE [{iv['order_index']}] {full[:8]} | {iv['question'][:80]}")
        req("DELETE", f"master_interview_questions?id=eq.{full}", want_json=False)

    # Verify final counts
    print("\n=== Post-delete verification ===")
    q_after = req("GET", f"master_quiz_questions?session_id=eq.{S2_SESSION}&select=id")
    iv_after = req("GET", f"master_interview_questions?session_id=eq.{S2_SESSION}&select=id")
    print(f"  Quiz remaining: {len(q_after)} (was 10)")
    print(f"  Interview remaining: {len(iv_after)} (was 10)")


if __name__ == "__main__":
    main()
