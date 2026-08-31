"""Guest (no-auth) mock interview endpoints for the landing-page Free Trial.

Everything is STATELESS on the server side: the frontend keeps the full
`stage_data` in localStorage and sends whatever it needs (turns, questions,
etc.) with every request. The server only:

  * grades submissions with Claude Haiku/Sonnet via the Emergent LLM key,
  * generates fresh aptitude questions on demand,
  * synthesises Pari's voice for the interview questions.

Aptitude answers are held in a small in-memory LRU cache keyed by trial_id
(so the client can't cheat by reading correct_index client-side). Everything
else is bounced back to the client. Backend restarts only lose the cached
answers, in which case the user can restart the aptitude round.
"""
from __future__ import annotations

import asyncio
import base64 as _b64
import hashlib as _hashlib
import json as _json
import logging
import re as _re
import time as _time
import urllib.parse as _urlparse
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

# Reuse LLM helpers + prompts from the authenticated engine so behaviour is
# identical across the two entry points.
from interview_sim_endpoints import (
    APPLICATION_FEEDBACK_PROMPT,
    CASE_FEEDBACK_PROMPT,
    FINAL_REPORT_PROMPT,
    INTERVIEWER_SYSTEM,
    OFFER_THRESHOLD,
    ROUND_SCORE_PROMPT,
    STAGE_WEIGHTS,
    _generate_aptitude,
    _parse_json,
    _public_sim,
    _transcript,
)

logger = logging.getLogger(__name__)

# Fixed sim slug for the free trial (product decision: JPM only).
FREE_TRIAL_SLUG = "jpmorgan"

# In-memory aptitude cache: trial_id -> {questions_with_answers, started_at}
# TTL enforced at read time (30 min). Simple LRU cap of 500 entries.
_APT_CACHE: Dict[str, Dict[str, Any]] = {}
_APT_CACHE_MAX = 500
_APT_TTL_SEC = 30 * 60

# TTS cache: sha1(text|voice|model) -> base64 audio
_GUEST_TTS_CACHE: Dict[str, str] = {}
_GUEST_TTS_CACHE_MAX = 500

# Deps injected at register time
_sb_get = None
_llm = None
_EMERGENT_LLM_KEY = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _valid_trial_id(trial_id: str) -> bool:
    """Trial IDs are UUIDs from free_mock_trials OR waitlist ids OR emails."""
    if not trial_id or len(trial_id) > 200:
        return False
    return bool(_re.fullmatch(r"[A-Za-z0-9@._+\-]{3,200}", trial_id))


# Per-trial-id LLM call counter: {trial_id: call_count}
# Resets on process restart; prevents bot-looping a single trial_id.
_TRIAL_LLM_CALL_COUNT: dict = {}
_TRIAL_LLM_CALL_LIMIT = 40   # max LLM calls per trial_id per server lifetime

# Per-IP-hash LLM call counter: {ip_hash: call_count}
# Prevents rotating trial IDs from bypassing the per-trial cap.
_IP_LLM_CALL_COUNT: dict = {}
_IP_LLM_CALL_LIMIT = 120   # max LLM calls per unique IP per server lifetime


def _client_ip_hash(request: Request) -> str:
    """Return a short sha256 hash of the caller's IP address."""
    xff = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = xff or (request.client.host if request.client else "") or ""
    return _hashlib.sha256(ip.encode()).hexdigest()[:16] if ip else ""


def _check_guest_rate_limit(trial_id: str, ip_hash: str = "") -> None:
    """Raise 429 if this trial_id OR originating IP has exceeded the LLM call cap."""
    # Check per-trial cap
    count = _TRIAL_LLM_CALL_COUNT.get(trial_id, 0)
    if count >= _TRIAL_LLM_CALL_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Trial LLM usage limit reached. Please register for full access.",
        )
    # Check per-IP cap (non-empty ip_hash only)
    if ip_hash:
        ip_count = _IP_LLM_CALL_COUNT.get(ip_hash, 0)
        if ip_count >= _IP_LLM_CALL_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Trial LLM usage limit reached. Please register for full access.",
            )
        _IP_LLM_CALL_COUNT[ip_hash] = ip_count + 1
    _TRIAL_LLM_CALL_COUNT[trial_id] = count + 1
    # Safety caps: trim dicts when they grow too large
    if len(_TRIAL_LLM_CALL_COUNT) > 2000:
        oldest = list(_TRIAL_LLM_CALL_COUNT.keys())[:500]
        for k in oldest:
            _TRIAL_LLM_CALL_COUNT.pop(k, None)
    if len(_IP_LLM_CALL_COUNT) > 1000:
        oldest = list(_IP_LLM_CALL_COUNT.keys())[:300]
        for k in oldest:
            _IP_LLM_CALL_COUNT.pop(k, None)


def _get_jpm_sim() -> dict:
    rows = _sb_get(
        f"master_interview_sims?firm_slug=eq.{FREE_TRIAL_SLUG}&is_active=eq.true&select=*&limit=1"
    ) or []
    if not rows:
        raise HTTPException(status_code=500, detail="J.P. Morgan simulation not configured")
    return rows[0]


def _apt_evict_expired():
    now = _time.time()
    for k in list(_APT_CACHE.keys()):
        if now - _APT_CACHE[k].get("_ts", 0) > _APT_TTL_SEC:
            _APT_CACHE.pop(k, None)


def register_guest_interview_sim_endpoints(api_router: APIRouter, deps: Dict[str, Any]) -> None:
    global _sb_get, _llm, _EMERGENT_LLM_KEY
    _sb_get = deps["supabase_get"]
    _EMERGENT_LLM_KEY = deps.get("emergent_llm_key")

    # Local LLM helper (mirrors interview_sim_endpoints._llm so we don't rely
    # on its module-level global being set — it may not be if that module
    # is registered under a fallback path).
    async def _llm_call(system: str, text: str, tag: str, model=("anthropic", "claude-haiku-4-5-20251001"), max_tokens: int = 900) -> str:
        if not _EMERGENT_LLM_KEY:
            return ""
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = (
            LlmChat(api_key=_EMERGENT_LLM_KEY, session_id=tag, system_message=system)
            .with_model(model[0], model[1])
            .with_params(max_tokens=max_tokens)
        )
        try:
            resp = await chat.send_message(UserMessage(text=text))
            return (resp or "").strip()
        except Exception as e:
            logger.warning(f"[guest-sim] LLM failed [{tag}]: {e}")
            return ""

    # ------------------------------------------------------------------ sim
    @api_router.get("/guest-sim/{trial_id}/sim")
    async def guest_sim_get(trial_id: str):
        if not _valid_trial_id(trial_id):
            raise HTTPException(status_code=400, detail="invalid trial id")
        sim = _get_jpm_sim()
        include_case = True  # guest player needs the workbook up front
        return {"sim": _public_sim(sim, include_case=include_case)}

    # ---------------------------------------------------------- application
    @api_router.post("/guest-sim/{trial_id}/application")
    async def guest_application(trial_id: str, body: dict, request: Request):
        if not _valid_trial_id(trial_id):
            raise HTTPException(status_code=400, detail="invalid trial id")
        _check_guest_rate_limit(trial_id, _client_ip_hash(request))
        sim = _get_jpm_sim()
        responses = (body or {}).get("responses") or {}
        required = ["why_firm", "why_er", "achievement"]
        for f in required:
            v = str(responses.get(f) or "").strip()
            if not v:
                raise HTTPException(status_code=400, detail=f"'{f}' is required")
            if len(v) > 2500:
                raise HTTPException(status_code=400, detail=f"'{f}' too long (max 2500 chars)")

        raw = await _llm_call(
            "You are a realistic finance recruiter. Output strict JSON only.",
            APPLICATION_FEEDBACK_PROMPT.format(
                firm=sim["firm_name"], role=sim["role_title"], location=sim.get("location") or "Mumbai",
                why_firm=responses.get("why_firm", "")[:1200],
                why_er=responses.get("why_er", "")[:1200],
                achievement=responses.get("achievement", "")[:1200],
                cover_note=responses.get("cover_note", "(none)")[:1200],
            ),
            f"gs-{trial_id}-application",
            max_tokens=900,
        )
        data = _parse_json(raw, {})
        score = max(0.0, min(100.0, float(data.get("score", 65) or 65)))
        result = {
            "responses": responses,
            "score": round(score, 1),
            "feedback_md": data.get("feedback_md") or "Your application was reviewed and shortlisted. Add more specific, quantified achievements next time.",
            "screening_note": data.get("screening_note") or "Shortlisted for online assessment.",
            "completed_at": _now(),
        }
        return {"ok": True, "application": result, "next_stage": "aptitude"}

    # ------------------------------------------------------------- aptitude
    @api_router.post("/guest-sim/{trial_id}/aptitude/start")
    async def guest_aptitude_start(trial_id: str):
        if not _valid_trial_id(trial_id):
            raise HTTPException(status_code=400, detail="invalid trial id")
        sim = _get_jpm_sim()
        proc = (sim.get("process") or {}).get("aptitude") or {}
        _apt_evict_expired()

        # Fast path: cached (same trial, still valid)
        entry = _APT_CACHE.get(trial_id)
        if entry and entry.get("questions"):
            public_qs = [{k: v for k, v in q.items() if k not in ("correct_index", "explanation")}
                         for q in entry["questions"]]
            return {
                "questions": public_qs,
                "started_at": entry["started_at"],
                "time_limit_minutes": int(proc.get("time_limit_minutes") or 15),
                "pass_pct": int(proc.get("pass_pct") or 40),
            }

        # Slow path: LLM gen takes 30-45s → run in background, poll
        gen_started = entry.get("_gen_started_at") if entry else None
        now_ts = _time.time()
        should_start = not gen_started or (now_ts - float(gen_started)) > 120
        if should_start:
            if len(_APT_CACHE) >= _APT_CACHE_MAX:
                _APT_CACHE.pop(next(iter(_APT_CACHE)), None)
            _APT_CACHE[trial_id] = {"_gen_started_at": now_ts, "_ts": now_ts}

            async def _bg():
                try:
                    qs = await _generate_aptitude(sim, f"gs-{trial_id}")
                    _APT_CACHE[trial_id] = {
                        "questions": qs,
                        "started_at": _now(),
                        "_ts": _time.time(),
                    }
                except Exception as exc:
                    logger.exception("[guest-sim] aptitude gen failed: %s", exc)
                    e = _APT_CACHE.get(trial_id) or {}
                    e["_gen_error"] = str(exc)[:200]
                    e["_ts"] = _time.time()
                    _APT_CACHE[trial_id] = e

            asyncio.create_task(_bg())

        return {
            "pending": True,
            "poll_seconds": 3,
            "time_limit_minutes": int(proc.get("time_limit_minutes") or 15),
            "pass_pct": int(proc.get("pass_pct") or 40),
        }

    @api_router.post("/guest-sim/{trial_id}/aptitude/submit")
    async def guest_aptitude_submit(trial_id: str, body: dict, request: Request):
        if not _valid_trial_id(trial_id):
            raise HTTPException(status_code=400, detail="invalid trial id")
        _check_guest_rate_limit(trial_id, _client_ip_hash(request))
        entry = _APT_CACHE.get(trial_id)
        if not entry or not entry.get("questions"):
            raise HTTPException(status_code=409, detail="test not started or expired — please restart")
        questions = entry["questions"]
        answers = (body or {}).get("answers")
        if not isinstance(answers, list):
            raise HTTPException(status_code=400, detail="answers must be a list")

        sim = _get_jpm_sim()
        cfg = (sim.get("process") or {}).get("aptitude") or {}
        pass_pct = float(cfg.get("pass_pct") or 40)

        correct = 0
        review = []
        for i, q in enumerate(questions):
            given = answers[i] if i < len(answers) else None
            ok = isinstance(given, int) and given == q["correct_index"]
            if ok:
                correct += 1
            review.append({
                "q": q["q"], "options": q["options"], "topic": q.get("topic"),
                "given_index": given if isinstance(given, int) else None,
                "correct_index": q["correct_index"],
                "correct": ok, "explanation": q.get("explanation") or "",
            })
        pct = round(correct / max(1, len(questions)) * 100.0, 1)
        passed = pct >= pass_pct

        by_topic: Dict[str, list] = {}
        for r in review:
            t = r.get("topic") or "other"
            by_topic.setdefault(t, [0, 0])
            by_topic[t][1] += 1
            if r["correct"]:
                by_topic[t][0] += 1
        topic_lines = ", ".join(f"{t}: {c}/{n}" for t, (c, n) in by_topic.items())
        fb = await _llm_call(
            "You are an assessment coach. Be specific and concise.",
            f"A candidate scored {pct}% ({correct}/{len(questions)}) on {sim['firm_name']}'s online aptitude test "
            f"(reference cutoff {pass_pct}%). Topic breakdown — {topic_lines}. "
            "They are advancing to the interview rounds regardless of this score. "
            "Write 90-130 words of markdown feedback: strongest area, weakest area with ONE tip, one line on pacing.",
            f"gs-{trial_id}-apt-fb",
            max_tokens=500,
        )
        apt = {
            "answers": answers,
            "score_pct": pct,
            "correct": correct,
            "total": len(questions),
            "passed": passed,
            "by_topic": {t: {"correct": c, "total": n} for t, (c, n) in by_topic.items()},
            "review": review,
            "feedback_md": fb or f"You scored {pct}% against a {pass_pct}% reference cutoff.",
            "completed_at": _now(),
        }
        # Clear the cache — no re-submits.
        _APT_CACHE.pop(trial_id, None)
        return {"ok": True, "aptitude": apt, "passed": passed, "next_stage": "behavioural"}

    # ------------------------------------------------------ interview rounds
    def _interviewer_system(sim: dict, stage: str) -> str:
        cfg = (sim.get("process") or {}).get(stage) or {}
        return INTERVIEWER_SYSTEM.format(
            stage_label="behavioural (HR)" if stage == "behavioural" else "technical",
            role=sim["role_title"], firm=sim["firm_name"], location=sim.get("location") or "Mumbai",
            persona=(sim.get("process") or {}).get("persona") or "A professional, probing interviewer.",
            focus=cfg.get("focus") or "General equity research readiness.",
            n=int(cfg.get("num_questions") or 5),
        )

    @api_router.post("/guest-sim/{trial_id}/interview/begin")
    async def guest_interview_begin(trial_id: str, body: dict, request: Request):
        if not _valid_trial_id(trial_id):
            raise HTTPException(status_code=400, detail="invalid trial id")
        _check_guest_rate_limit(trial_id, _client_ip_hash(request))
        stage = (body or {}).get("stage")
        if stage not in ("behavioural", "technical"):
            raise HTTPException(status_code=400, detail="stage must be behavioural or technical")
        sim = _get_jpm_sim()
        first = await _llm_call(
            _interviewer_system(sim, stage),
            "Start the round now. Give a one-sentence warm, realistic greeting introducing yourself by role "
            "(no personal names), then ask your FIRST question. Keep both together in one message.",
            f"gs-{trial_id}-{stage}-q1",
            max_tokens=400,
        ) or ("Welcome — let's begin. Tell me about a time you worked under real pressure. Walk me through it using the STAR structure."
              if stage == "behavioural" else
              "Welcome — let's get into technicals. Walk me through how you would build a DCF for an Indian consumer company.")
        num_q = int(((sim.get("process") or {}).get(stage) or {}).get("num_questions") or 5)
        return {"turns": [{"role": "interviewer", "content": first, "at": _now()}], "num_questions": num_q}

    @api_router.post("/guest-sim/{trial_id}/interview/answer")
    async def guest_interview_answer(trial_id: str, body: dict, request: Request):
        if not _valid_trial_id(trial_id):
            raise HTTPException(status_code=400, detail="invalid trial id")
        _check_guest_rate_limit(trial_id, _client_ip_hash(request))
        b = body or {}
        stage = b.get("stage")
        if stage not in ("behavioural", "technical"):
            raise HTTPException(status_code=400, detail="stage must be behavioural or technical")
        answer = str(b.get("answer") or "").strip()
        input_method = b.get("input_method") or "text"
        turns_in = b.get("turns") or []
        if not answer:
            raise HTTPException(status_code=400, detail="answer required")
        if len(answer) > 6000:
            raise HTTPException(status_code=400, detail="answer too long (max 6000 chars)")
        if not isinstance(turns_in, list) or not turns_in:
            raise HTTPException(status_code=400, detail="turns required (call /interview/begin first)")

        sim = _get_jpm_sim()
        cfg = (sim.get("process") or {}).get(stage) or {}
        n_questions = int(cfg.get("num_questions") or 5)

        turns = list(turns_in)
        turns.append({"role": "candidate", "content": answer, "input_method": input_method, "at": _now()})
        answered = sum(1 for t in turns if t.get("role") == "candidate")

        if answered >= n_questions:
            closing = "Thank you — that wraps up this round. The team will review your responses."
            turns.append({"role": "interviewer", "content": closing, "at": _now()})
            # Score
            raw = await _llm_call(
                "You are a senior interview coach scoring mock finance interview rounds. Output strict JSON only.",
                ROUND_SCORE_PROMPT.format(
                    stage_label="behavioural" if stage == "behavioural" else "technical",
                    role=sim["role_title"], firm=sim["firm_name"],
                    transcript=_transcript(turns)[:7000]),
                f"gs-{trial_id}-{stage}-score",
                max_tokens=1200,
            )
            data = _parse_json(raw, {})
            score = max(0.0, min(100.0, float(data.get("score", 60) or 60)))
            result = {
                "score": round(score, 1),
                "strengths": data.get("strengths") or ["Engaged with every question"],
                "gaps": data.get("gaps") or ["Answers could be more specific"],
                "feedback_bullets": data.get("feedback_bullets") or ["Quantify your impact", "Use real Indian company examples", "Tighten structure"],
                "per_question": data.get("per_question") or [],
                "turns": turns,
                "completed_at": _now(),
            }
            next_stage = "technical" if stage == "behavioural" else "case_study"
            return {"round_complete": True, "closing": closing, "result": result, "next_stage": next_stage}

        next_q = await _llm_call(
            _interviewer_system(sim, stage),
            f"Conversation so far:\n\n{_transcript(turns)[:7000]}\n\n"
            f"The candidate has answered {answered} of {n_questions} questions. "
            "Continue the interview with ONE next question or follow-up.",
            f"gs-{trial_id}-{stage}-q{answered + 1}",
            max_tokens=400,
        ) or "Interesting. Can you make that concrete — give me a specific example with numbers?"
        turns.append({"role": "interviewer", "content": next_q, "at": _now()})
        return {"round_complete": False, "next_question": next_q,
                "turns": turns, "answered": answered, "num_questions": n_questions}

    # ------------------------------------------------------------ case study
    @api_router.post("/guest-sim/{trial_id}/case/submit")
    async def guest_case_submit(trial_id: str, body: dict, request: Request):
        if not _valid_trial_id(trial_id):
            raise HTTPException(status_code=400, detail="invalid trial id")
        _check_guest_rate_limit(trial_id, _client_ip_hash(request))
        b = body or {}
        sim = _get_jpm_sim()
        recommendation = str(b.get("recommendation") or "").strip()
        excel = b.get("excel_score") or {}
        stage_data = b.get("stage_data") or {}
        if len(recommendation) < 120:
            raise HTTPException(status_code=400, detail="recommendation too short — write at least ~150 words")
        if len(recommendation) > 6000:
            raise HTTPException(status_code=400, detail="recommendation too long")
        try:
            excel_total = max(0.0, min(100.0, float(excel.get("total", 0) or 0)))
        except Exception:
            excel_total = 0.0

        case_summary = _json.dumps((sim.get("case_config") or {}).get("expected_summary") or {})
        raw = await _llm_call(
            "You are a senior equity research analyst evaluating case rounds. Output strict JSON only.",
            CASE_FEEDBACK_PROMPT.format(
                firm=sim["firm_name"], role=sim["role_title"], excel_score=round(excel_total),
                case_summary=case_summary, recommendation=recommendation[:4500],
            ),
            f"gs-{trial_id}-case",
            max_tokens=1000,
        )
        data = _parse_json(raw, {})
        written = max(0.0, min(100.0, float(data.get("written_score", 60) or 60)))
        combined = round(excel_total * 0.5 + written * 0.5, 1)
        case_result = {
            "excel_score": {"total": excel_total, "per_cell": excel.get("per_cell") or {}},
            "recommendation": recommendation,
            "written_score": round(written, 1),
            "score": combined,
            "feedback_md": data.get("feedback_md") or "Your recommendation was reviewed. Anchor the call more explicitly to your model's output next time.",
            "completed_at": _now(),
        }

        # Finalize — compute verdict + Sonnet report using full stage_data
        sd = dict(stage_data)
        sd["case_study"] = case_result
        scores = {
            "aptitude": (sd.get("aptitude") or {}).get("score_pct"),
            "behavioural": (sd.get("behavioural") or {}).get("score"),
            "technical": (sd.get("technical") or {}).get("score"),
            "case_study": case_result["score"],
        }
        total_w = sum(w for k, w in STAGE_WEIGHTS.items() if scores.get(k) is not None)
        final_score = round(
            sum(float(scores[k]) * w for k, w in STAGE_WEIGHTS.items() if scores.get(k) is not None)
            / (total_w or 1.0), 1)
        verdict = "offer" if final_score >= OFFER_THRESHOLD else "rejected"

        stage_summary = "\n".join(
            f"- {k}: {scores[k] if scores[k] is not None else 'not reached'}{' /100' if scores[k] is not None else ''}"
            for k in ("aptitude", "behavioural", "technical", "case_study")
        )
        excerpts = []
        for st in ("behavioural", "technical"):
            for t in ((sd.get(st) or {}).get("turns") or []):
                if t.get("role") == "candidate":
                    excerpts.append(f"({st}) {t['content'][:220]}")
        excerpts.append(f"(case recommendation) {recommendation[:400]}")
        if (sd.get("application") or {}).get("responses"):
            excerpts.insert(0, f"(application — why firm) {sd['application']['responses'].get('why_firm', '')[:200]}")

        letter_kind = "offer" if verdict == "offer" else "rejection"
        letter_extra = (f", mentioning the compensation band {sim.get('salary_band')}"
                        if verdict == "offer" else
                        ", polite and encouraging, inviting them to reapply")
        raw2 = await _llm_call(
            "You are a hiring committee chair writing realistic hiring documents. Output strict JSON only.",
            FINAL_REPORT_PROMPT.format(
                firm=sim["firm_name"], role=sim["role_title"], location=sim.get("location") or "Mumbai",
                salary_band=sim.get("salary_band") or "competitive", stage_summary=stage_summary,
                final_score=final_score, verdict_word="OFFER EXTENDED" if verdict == "offer" else "NOT SELECTED",
                excerpts="\n".join(excerpts[:12]) or "(none)", letter_kind=letter_kind, letter_extra=letter_extra,
            ),
            f"gs-{trial_id}-final",
            model=("anthropic", "claude-sonnet-4-5-20250929"),
            max_tokens=1800,
        )
        d2 = _parse_json(raw2, {})
        letter_md = d2.get("letter_md") or (
            f"**{sim['firm_name']} — Talent Acquisition**\n\nDear Candidate,\n\n"
            + ("We are delighted to extend you an offer for the role of "
               f"{sim['role_title']} ({sim.get('salary_band')}). Congratulations!"
               if verdict == "offer" else
               f"Thank you for interviewing for the {sim['role_title']} role. After careful consideration we will not be "
               "moving forward at this time.")
        )
        report_md = d2.get("report_md") or (
            f"Final weighted score: **{final_score}/100**. "
            "Focus on adding specific numbers and Indian-market examples to every answer."
        )
        decision = {
            "final_score": final_score,
            "verdict": verdict,
            "stage_scores": scores,
            "rejected_at": None,
            "letter_md": letter_md,
            "report_md": report_md,
            "completed_at": _now(),
        }
        return {"ok": True, "case_study": case_result, "decision": decision,
                "final_score": final_score, "verdict": verdict, "next_stage": "decision"}

    # -------------------------------------------------------------------- TTS
    @api_router.post("/guest-sim/{trial_id}/tts")
    async def guest_tts(trial_id: str, body: dict, request: Request):
        if not _valid_trial_id(trial_id):
            raise HTTPException(status_code=400, detail="invalid trial id")
        _check_guest_rate_limit(trial_id, _client_ip_hash(request))
        text = str((body or {}).get("text") or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="text is required")
        if len(text) > 3800:
            text = text[:3800]
        voice = (body or {}).get("voice") or "nova"
        if voice not in {"alloy", "ash", "coral", "echo", "fable",
                          "nova", "onyx", "sage", "shimmer"}:
            voice = "nova"
        model = "tts-1"

        key = _hashlib.sha1(f"{model}|{voice}|{text}".encode("utf-8")).hexdigest()
        cached = _GUEST_TTS_CACHE.get(key)
        if cached:
            return {"audio_base64": cached, "mime": "audio/mpeg", "cached": True}
        if not _EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="TTS is not configured")
        try:
            from emergentintegrations.llm.openai import OpenAITextToSpeech
            tts = OpenAITextToSpeech(api_key=_EMERGENT_LLM_KEY)
            audio_bytes = await tts.generate_speech(
                text=text, model=model, voice=voice, response_format="mp3",
            )
        except Exception as exc:
            logger.warning("[guest-sim] tts failed: %s", exc)
            raise HTTPException(status_code=502, detail=f"tts failed: {exc}")
        b64 = _b64.b64encode(audio_bytes).decode("ascii")
        if len(_GUEST_TTS_CACHE) >= _GUEST_TTS_CACHE_MAX:
            _GUEST_TTS_CACHE.pop(next(iter(_GUEST_TTS_CACHE)), None)
        _GUEST_TTS_CACHE[key] = b64
        return {"audio_base64": b64, "mime": "audio/mpeg", "cached": False}

    logger.info("[guest-sim] endpoints registered")
