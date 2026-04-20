from fastapi import FastAPI, APIRouter, HTTPException, Depends
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


@api_router.delete("/waitlist/{entry_id}")
async def delete_waitlist_entry(entry_id: str, payload=Depends(verify_token)):
    result = await db.waitlist.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": True}


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
