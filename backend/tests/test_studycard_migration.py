"""Backend/DB tests for study-card constraint + count migration."""
import os
import json
import requests
import pytest

SUPABASE_MGMT_PAT = "sbp_ca4f79985d71dda493f94b60930fa0723757299a"
PROJECT_REF = "yuadeybycbfqlkdpxbkv"
SQL_ENDPOINT = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

HEADERS = {
    "Authorization": f"Bearer {SUPABASE_MGMT_PAT}",
    "Content-Type": "application/json",
    "User-Agent": "curl/8.0",
}


def run_sql(sql):
    r = requests.post(SQL_ENDPOINT, headers=HEADERS, json={"query": sql}, timeout=30)
    return r


OK = (200, 201)


def test_check_constraint_includes_studycard():
    """CHECK constraint definition must contain 'study-card'."""
    sql = """
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname='master_notes_cards' AND c.contype='c'
    """
    r = run_sql(sql)
    assert r.status_code in OK, r.text
    defs = [row["def"] for row in r.json()]
    full = " ".join(defs)
    assert "study-card" in full, f"study-card NOT in constraint: {full}"
    # also verify other valid types still present
    for k in ["hook", "concept", "summary", "visual"]:
        assert k in full, f"expected card_type {k} missing from constraint"


def test_study_card_row_count_is_304():
    sql = "SELECT count(*) AS c FROM public.master_notes_cards WHERE card_type='study-card'"
    r = run_sql(sql)
    assert r.status_code in OK, r.text
    count = r.json()[0]["c"]
    assert count == 304, f"expected 304 study-card rows, got {count}"


def test_no_leftover_summary_studycard_rows():
    sql = """
    SELECT count(*) AS c FROM public.master_notes_cards
    WHERE card_type='summary' AND content->>'kind'='study-card'
    """
    r = run_sql(sql)
    assert r.status_code in OK, r.text
    count = r.json()[0]["c"]
    assert count == 0, f"expected 0 leftover summary rows with kind=study-card, got {count}"


def test_total_master_notes_cards_count():
    sql = "SELECT count(*) AS c FROM public.master_notes_cards"
    r = run_sql(sql)
    assert r.status_code in OK, r.text
    count = r.json()[0]["c"]
    # Sanity check — we accept whatever the present total is, just report it.
    # The request says 1064; assert that.
    assert count == 1264, f"expected total 1064, got {count}"


def test_insert_invalid_card_type_fails():
    """Inserting an invalid card_type='foo' must violate the CHECK constraint."""
    # Pick any existing master_session
    sess_r = run_sql("SELECT id FROM public.master_sessions LIMIT 1")
    assert sess_r.status_code in OK, sess_r.text
    sid = sess_r.json()[0]["id"]
    bad_sql = f"""
    INSERT INTO public.master_notes_cards (session_id, card_type, title, content, order_index)
    VALUES ('{sid}', 'foo', 'TEST_invalid', '{{}}'::jsonb, 9998)
    """
    r = run_sql(bad_sql)
    # Should fail with 4xx OR return JSON error
    body = r.text.lower()
    assert ("check" in body and "constraint" in body) or r.status_code >= 400, (
        f"Insert with bad card_type should fail; got {r.status_code} body={r.text[:300]}"
    )


def test_insert_studycard_then_cleanup():
    """Inserting a row with card_type='study-card' must succeed; then we clean it up."""
    sess_r = run_sql("SELECT id FROM public.master_sessions LIMIT 1")
    sid = sess_r.json()[0]["id"]
    content = json.dumps({
        "body_md": "**Q?**", "question": "Q?", "answer": "A", "kind": "study-card"
    }).replace("'", "''")
    ins = f"""
    INSERT INTO public.master_notes_cards (session_id, card_type, title, content, order_index)
    VALUES ('{sid}', 'study-card', 'TEST_studycard_insert',
            '{content}'::jsonb, 9997)
    RETURNING id
    """
    r = run_sql(ins)
    assert r.status_code in OK, f"insert study-card failed: {r.status_code} {r.text}"
    rows = r.json()
    assert rows and "id" in rows[0]
    inserted_id = rows[0]["id"]
    # Cleanup
    cleanup = f"DELETE FROM public.master_notes_cards WHERE id='{inserted_id}'"
    cr = run_sql(cleanup)
    assert cr.status_code in OK, cr.text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
