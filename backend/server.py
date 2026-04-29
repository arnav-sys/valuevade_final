from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
import uuid
import re
import string
import hashlib
import jwt
from datetime import datetime, timezone
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET')

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


def generate_referral_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def create_token(email: str):
    return jwt.encode({"email": email, "iat": int(datetime.now(timezone.utc).timestamp())}, ADMIN_SECRET, algorithm="HS256")


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, ADMIN_SECRET, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


class WaitlistCreate(BaseModel):
    first_name: str
    email: str
    ref_code: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v):
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
            raise ValueError('Invalid email format')
        return v


class WaitlistResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    first_name: str
    email: str
    position: int
    timestamp: str
    referral_code: str
    referral_count: int


class AdminLogin(BaseModel):
    email: str
    password: str


@api_router.get("/")
async def root():
    return {"message": "Valuevade API"}


@api_router.post("/admin/login")
async def admin_login(creds: AdminLogin):
    if creds.email == ADMIN_EMAIL and creds.password == ADMIN_PASSWORD:
        token = create_token(creds.email)
        return {"token": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")


@api_router.get("/waitlist/all")
async def get_all_waitlist(payload=Depends(verify_token)):
    cursor = db.waitlist.find(
        {},
        {"first_name": 1, "email": 1, "position": 1, "referral_code": 1, "referral_count": 1, "referred_by": 1, "timestamp": 1},
    ).sort("_id", -1)
    entries = await cursor.to_list(1000)
    for e in entries:
        e.pop("_id", None)
    return entries


@api_router.post("/waitlist", response_model=WaitlistResponse)
async def join_waitlist(entry: WaitlistCreate):
    existing = await db.waitlist.find_one({"email": entry.email}, {"_id": 0})
    if existing:
        if "referral_code" not in existing:
            referral_code = generate_referral_code()
            while await db.waitlist.find_one({"referral_code": referral_code}):
                referral_code = generate_referral_code()
            existing["referral_code"] = referral_code
        if "referral_count" not in existing:
            existing["referral_count"] = 0
        await db.waitlist.update_one(
            {"email": entry.email},
            {"$set": {"referral_code": existing["referral_code"], "referral_count": existing["referral_count"]}}
        )
        return existing

    referral_code = generate_referral_code()
    while await db.waitlist.find_one({"referral_code": referral_code}):
        referral_code = generate_referral_code()

    position = random.randint(200, 350)
    doc = {
        "id": str(uuid.uuid4()),
        "first_name": entry.first_name,
        "email": entry.email,
        "position": position,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "referral_code": referral_code,
        "referral_count": 0,
        "referred_by": entry.ref_code or None,
    }
    await db.waitlist.insert_one(doc)
    doc.pop("_id", None)

    if entry.ref_code:
        referrer = await db.waitlist.find_one({"referral_code": entry.ref_code})
        if referrer:
            new_position = max(1, referrer["position"] - 5)
            await db.waitlist.update_one(
                {"referral_code": entry.ref_code},
                {"$inc": {"referral_count": 1}, "$set": {"position": new_position}},
            )

    return doc


@api_router.get("/waitlist/count")
async def get_waitlist_count():
    count = await db.waitlist.count_documents({})
    return {"count": count + 500}


from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText
import json as json_module

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')


class CustomizeRequest(BaseModel):
    answers: List[dict]
    free_text: str = ''
    course_structure: List[dict]
    course_title: str = ''


CUSTOMIZE_SYSTEM_PROMPT = """You are a curriculum design AI for Valuevade, an AI-powered finance career platform for Indian finance students. Your job is to take a fixed course structure and a set of user profiling answers, then output a personalised customisation plan as structured JSON.

---

COURSE STRUCTURE

You will receive the full course as a JSON array of modules. Each module has:

- module_number (integer)
- module_title (string)
- sessions (array of session objects, each with session_number, session_title, session_id)

The last 2 modules are ALWAYS locked. Never remove, reorder, or modify them under any circumstance.

---

USER ANSWERS

You will receive an array of answered questions. Each answer object contains:

- question_text (string)
- selected_value (string)
- purpose (string) — explains what this answer signals about the user and which modules it affects

You may also receive an optional free_text field containing anything the user typed in their own words. Use it as a soft signal to refine decisions already implied by the structured answers.

---

YOUR TASK

Analyse every answer against its purpose field. Then produce a customisation plan — a list of change objects — that tailors the course to this specific user. Apply the following decision logic:

REMOVAL LOGIC (use these exact triggers):

- background = fin_grad OR professional → remove M1, M2
- indian_markets = deep → remove M2
- excel = advanced OR expert → remove M3
- modelling = confident → remove M4
- annual_reports = analyst_level → remove M6
- accounting = advanced → remove M7
- accounting_depth = yes → remove M8
- ratio = advanced → remove M9
- macro = moderate OR deep → remove M10
- valuation = full → remove M12

ADDITION LOGIC (modules added only when user opts in):

- governance = yes OR (governance = maybe AND goal = er OR pm) → keep M5
- sector = yes_target OR yes_broad → keep M11
- macro = no OR casually AND goal = er OR pm OR explore → keep M10
- communication = yes_both OR ppt_only OR reports_only → keep M13
- career_tools = active OR planning → keep M14

CERTIFICATION OVERRIDE (applied after all other logic):

- certifications includes cfa → force keep M7, M9, M10 even if removal logic triggered them
- certifications includes frm → force keep M8, M10 even if removal logic triggered them
- certifications includes ca → force keep M1, M7 even if removal logic triggered them

CONSERVATIVE RULES (non-negotiable):

1. Never remove all sessions from a module. If a module is being removed, the action is remove_module, not individual session removals.
2. Never let the total session count across the final plan fall below 15.
3. When in doubt between removing and keeping a module, keep it. Only remove when the trigger is an exact match.
4. Never remove the last 2 modules under any circumstance.
5. If background = beginner, suppress all removals except Excel and Modelling. A beginner needs the full foundations regardless of individual answers.

SESSION-LEVEL CHANGES (apply only when a full module is kept but partially redundant):

- If accounting = comfortable (not advanced), remove only the introductory sessions of M7 (first 1-2 sessions) rather than the whole module.
- If excel = intermediate, remove only the absolute basics sessions of M3 (first 1 session) rather than the whole module.
- If modelling = basic, remove only the orientation/intro session of M4 rather than the whole module.
- Use remove_session sparingly. Only apply it when you are confident the user has clearly covered that ground.

REORDER LOGIC:

- If goal = ib, move M12 (Valuation) earlier — place it at position 5 in the final order.
- If goal = er OR pm, move M11 (Sector Analysis, if kept) to come immediately after M10 (Macro).
- If career_tools = active, move M14 (Resume and Networking) to position 3 in the final order so the user can start job prep early.
- Only reorder when it meaningfully changes the learning journey. Do not reorder for cosmetic reasons.

---

OUTPUT FORMAT

Return a single JSON object with the following structure. Output raw JSON only — no markdown, no explanation outside the JSON, no preamble.

{
"user_profile_summary": "2-3 sentence plain English summary of who this user is based on their answers",
"total_modules_final": <integer>,
"total_sessions_final": <integer>,
"customisation_plan": [
{
"action": "remove_module",
"module_number": <integer>,
"module_title": "<string>",
"reason": "<one sentence explanation referencing the specific answer that triggered this>"
},
{
"action": "remove_session",
"module_number": <integer>,
"module_title": "<string>",
"session_id": "<uuid>",
"session_title": "<string>",
"reason": "<one sentence explanation>"
},
{
"action": "add_session",
"module_number": <integer>,
"module_title": "<string>",
"session_title": "<string>",
"insert_after_session_number": <integer>,
"reason": "<one sentence explanation>"
},
{
"action": "reorder_module",
"module_number": <integer>,
"module_title": "<string>",
"new_position": <integer>,
"reason": "<one sentence explanation>"
}
],
"final_modules": [
{
"position": <integer>,
"module_number": <integer>,
"module_title": "<string>",
"status": "kept" | "removed" | "reordered" | "locked",
"sessions_removed": <integer>,
"final_session_count": <integer>
}
],
"locked_modules": [],
"conservative_flags": []
}"""


@api_router.post("/customize/generate")
async def generate_customization(req: CustomizeRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    # Build course structure for the prompt
    modules_for_prompt = []
    for i, mod in enumerate(req.course_structure):
        sessions = mod.get('master_sessions', [])
        sess_list = []
        for j, s in enumerate(sessions):
            sess_list.append({
                "session_number": j + 1,
                "session_title": s.get('title', ''),
                "session_id": s.get('id', ''),
            })
        modules_for_prompt.append({
            "module_number": i + 1,
            "module_title": mod.get('title', ''),
            "sessions": sess_list,
        })

    # Build answers for the prompt
    answers_for_prompt = []
    for a in req.answers:
        answer_val = a.get('answer')
        if isinstance(answer_val, list):
            answer_val = ', '.join(str(v) for v in answer_val)
        elif isinstance(answer_val, dict):
            answer_val = json_module.dumps(answer_val)
        answers_for_prompt.append({
            "question_text": a.get('question_text', ''),
            "selected_value": str(answer_val) if answer_val is not None else 'not answered',
            "purpose": a.get('purpose', ''),
        })

    user_message_text = json_module.dumps({
        "course_title": req.course_title,
        "course_structure": modules_for_prompt,
        "user_answers": answers_for_prompt,
        "free_text": req.free_text or "",
    }, indent=2)

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"customize-{uuid.uuid4()}",
            system_message=CUSTOMIZE_SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-4-sonnet-20250514")

        response = await chat.send_message(UserMessage(text=user_message_text))

        # Parse JSON from response (strip markdown fences if present)
        response_text = response.strip()
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            lines = [l for l in lines if not l.strip().startswith('```')]
            response_text = '\n'.join(lines)

        plan = json_module.loads(response_text)
        return plan

    except json_module.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response: {e}")
        logger.error(f"Raw response: {response_text[:500]}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response. Please try again.")
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


# ---------------- Visual Card Image Generation ----------------
class VisualGenRequest(BaseModel):
    card_id: str
    title: str = ''
    description: str = ''


VISUAL_STYLE_PROMPT = (
    "Ultra-clean minimal vector illustration for a premium finance education app called Valuevade. "
    "Aesthetic: soft pastel pink background (#F2E6EE or #EAD9E5), elegant modern flat design, "
    "thin geometric lines, rounded corners, subtle depth, lots of whitespace. "
    "Strict color palette: primary blue #246BFD, purple accent #6A5CFF, pink accent #FF6AC1, "
    "success green #10B981, dark text #1A1A2E. "
    "Style is editorial and calm — like a high-end finance textbook. "
    "No photographs, no realistic people, no busy backgrounds, no cluttered text, no logos. "
    "Focus: a single clear visual metaphor with minimal annotations. "
    "Square 1024x1024 composition."
)


@api_router.post("/visual/generate")
async def generate_visual(req: VisualGenRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    prompt_subject = req.title.strip() or 'Finance concept'
    if req.description:
        prompt_subject += f". Context: {req.description.strip()[:400]}"

    full_prompt = (
        f"Create a conceptual diagram illustrating: {prompt_subject}. "
        f"{VISUAL_STYLE_PROMPT}"
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"visual-{req.card_id}-{uuid.uuid4()}",
            system_message="You are an expert visual designer creating educational illustrations for a premium finance learning app.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        _text, images = await chat.send_message_multimodal_response(
            UserMessage(text=full_prompt)
        )

        if not images:
            raise HTTPException(status_code=500, detail="No image generated")

        img = images[0]
        mime = img.get('mime_type') or 'image/png'
        data = img.get('data') or ''
        data_url = f"data:{mime};base64,{data}"

        logger.info(f"Generated visual for card {req.card_id} ({len(data)} b64 chars)")
        return {"image_url": data_url, "card_id": req.card_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Visual generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")


@api_router.delete("/waitlist/{entry_id}")
async def delete_waitlist_entry(entry_id: str, payload=Depends(verify_token)):
    result = await db.waitlist.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": True}


# ---------------- Interview Response Evaluation ----------------
class InterviewEvalRequest(BaseModel):
    question: str
    response: str
    context: Optional[str] = ''
    evaluation_criteria: Optional[dict] = None
    model_answer: Optional[str] = ''
    session_title: Optional[str] = ''
    question_id: Optional[str] = None  # used for cache key


INTERVIEW_EVAL_SYSTEM_PROMPT = """You are a Senior Analyst at a top investment firm conducting a mock interview for a finance student at Valuevade. Your job is to evaluate the candidate's spoken/typed response to an interview question.

You will receive:
- The interview question
- The candidate's response
- Optional setup/context for the question
- Evaluation criteria (a JSONB object — may contain any of: must_cover, key_points, keywords, bonus_points, red_flags, or arbitrary fields that describe what a strong answer looks like)
- Optional sample strong answer

You MUST evaluate the candidate's response and return STRICT JSON in this exact shape (no markdown, no prose):

{
  "scores": {
    "technical": <integer 1-5>,
    "communication": <integer 1-5>,
    "structure": <integer 1-5>,
    "overall": <integer 1-5>
  },
  "feedback": {
    "strengths": ["<2-4 specific bullet points referring to THIS exact answer>"],
    "improvements": ["<2-4 specific bullet points referring to THIS exact answer>"]
  }
}

SCORING RUBRIC (1-5):
- technical: Accuracy of finance concepts, coverage of the must_cover / key_points from evaluation_criteria, correct formulas/numbers. 5 = mastery; 3 = mostly correct with gaps; 1 = fundamentally wrong.
- communication: Clarity, conciseness, use of plain language, avoidance of filler. 5 = interview-ready; 1 = confusing or sparse.
- structure: Logical flow (conclusion-first, clear reasoning, transitions). 5 = textbook structure; 1 = rambling or one-dimensional.
- overall: Holistic judgement, not a strict average. Round to integer.

FEEDBACK RULES (CRITICAL — this is what makes the feedback useful):
1. Every bullet MUST reference something specific the candidate actually said or omitted. Quote short phrases or call out concrete numbers/concepts.
2. NEVER produce generic feedback like "Good answer" or "Add more detail". Always say what specifically was good and what specifically to improve.
3. If the response is very short or off-topic, say so plainly.
4. Keep bullets under 25 words each. Crisp, like a real interviewer.
5. Calibrate tone to the finance domain — you're mentoring, not grading.
6. If evaluation_criteria.red_flags triggered, surface them in improvements.
7. If evaluation_criteria.bonus_points achieved, highlight in strengths.
8. Use the sample_strong_answer only as a reference — do NOT ask the candidate to memorize it.

Return ONLY the JSON object. No code fences. No preamble."""


@api_router.post("/interview/evaluate")
async def evaluate_interview_response(req: InterviewEvalRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    resp_text = (req.response or '').strip()
    if len(resp_text) < 10:
        raise HTTPException(status_code=400, detail="Response too short to evaluate")

    # Build normalised response hash for caching: whitespace-collapsed, lowercased.
    normalised = re.sub(r'\s+', ' ', resp_text.lower()).strip()
    response_hash = hashlib.sha256(normalised.encode('utf-8')).hexdigest()

    # Cache lookup — only when we have a question_id to scope the key.
    if req.question_id:
        cached = await db.interview_eval_cache.find_one(
            {"question_id": req.question_id, "response_hash": response_hash},
            {"_id": 0, "scores": 1, "feedback": 1},
        )
        if cached and cached.get('scores') and cached.get('feedback'):
            logger.info(f"[interview-eval] cache hit q={req.question_id} h={response_hash[:8]}")
            return {
                "scores": cached['scores'],
                "feedback": cached['feedback'],
                "cached": True,
            }

    payload = {
        "session_title": req.session_title or '',
        "question": req.question or '',
        "context": req.context or '',
        "candidate_response": resp_text,
        "evaluation_criteria": req.evaluation_criteria or {},
        "sample_strong_answer": (req.model_answer or '')[:1200],
    }

    user_message_text = json_module.dumps(payload, indent=2)

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"interview-eval-{uuid.uuid4()}",
            system_message=INTERVIEW_EVAL_SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-4-sonnet-20250514")

        response = await chat.send_message(UserMessage(text=user_message_text))

        # Strip markdown fences if the model added any
        response_text = (response or '').strip()
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            lines = [l for l in lines if not l.strip().startswith('```')]
            response_text = '\n'.join(lines)

        result = json_module.loads(response_text)

        # Minimal validation + sanitisation
        scores = result.get('scores') or {}
        feedback = result.get('feedback') or {}

        def clamp(v, lo=1, hi=5):
            try:
                n = int(round(float(v)))
            except (TypeError, ValueError):
                n = lo
            return max(lo, min(hi, n))

        def str_list(v):
            if not isinstance(v, list):
                return []
            out = []
            for item in v:
                if isinstance(item, str) and item.strip():
                    out.append(item.strip())
                elif isinstance(item, dict):
                    txt = item.get('text') or item.get('point') or ''
                    if txt:
                        out.append(str(txt).strip())
            return out[:6]

        clean = {
            "scores": {
                "technical": clamp(scores.get('technical')),
                "communication": clamp(scores.get('communication')),
                "structure": clamp(scores.get('structure')),
                "overall": clamp(scores.get('overall')),
            },
            "feedback": {
                "strengths": str_list(feedback.get('strengths')) or ["You took a clear stance — good starting point"],
                "improvements": str_list(feedback.get('improvements')) or ["Try leading with the conclusion for extra impact"],
            },
        }

        # Persist to cache (best-effort; ignore Mongo write errors).
        if req.question_id:
            try:
                await db.interview_eval_cache.update_one(
                    {"question_id": req.question_id, "response_hash": response_hash},
                    {
                        "$set": {
                            "question_id": req.question_id,
                            "response_hash": response_hash,
                            "scores": clean["scores"],
                            "feedback": clean["feedback"],
                            "response_preview": resp_text[:240],
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        },
                        "$setOnInsert": {
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        },
                    },
                    upsert=True,
                )
                logger.info(f"[interview-eval] cache store q={req.question_id} h={response_hash[:8]}")
            except Exception as cache_err:
                logger.warning(f"[interview-eval] cache write failed: {cache_err}")

        return {**clean, "cached": False}

    except json_module.JSONDecodeError as e:
        logger.error(f"Failed to parse interview eval response: {e}")
        logger.error(f"Raw response: {(response_text or '')[:500]}")
        raise HTTPException(status_code=502, detail="AI returned invalid response format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Interview evaluation failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI evaluation failed: {str(e)}")


# ----------------------- Voice transcription (Whisper) ----------------------

# Allowed audio mime/extension hints — Whisper accepts mp3, mp4, mpeg, mpga,
# m4a, wav, webm. Browser MediaRecorder typically produces audio/webm.
_ALLOWED_AUDIO_EXTS = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg"}
_MAX_AUDIO_BYTES = 25 * 1024 * 1024  # Whisper hard limit


@api_router.post("/voice/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(default="en"),
    prompt: Optional[str] = Form(default=None),
):
    """
    Transcribe a short audio clip recorded in the browser to text using
    OpenAI Whisper (whisper-1) via the Emergent LLM key. Used by the
    Interview practice flow so users can speak their answer instead of
    typing it.
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="Speech-to-text service is not configured")

    # Validate extension
    filename = audio.filename or "audio.webm"
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'webm'
    if ext not in _ALLOWED_AUDIO_EXTS:
        # MediaRecorder sometimes sends 'blob' as filename — fall back to webm
        ext = 'webm'
        filename = 'audio.webm'

    # Read into memory and validate size (Whisper limit is 25MB)
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    if len(data) > _MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file exceeds 25MB limit")

    # Whisper SDK expects a file-like object with a name attribute
    import io
    buf = io.BytesIO(data)
    buf.name = filename

    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        kwargs = {
            "file": buf,
            "model": "whisper-1",
            "response_format": "json",
        }
        if language:
            kwargs["language"] = language
        if prompt:
            kwargs["prompt"] = prompt[:1024]
        response = await stt.transcribe(**kwargs)
        text = getattr(response, "text", None)
        if text is None and isinstance(response, dict):
            text = response.get("text")
        if not text:
            raise HTTPException(status_code=500, detail="Transcription returned empty result")
        return {"text": text.strip()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
