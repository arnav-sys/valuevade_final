from fastapi import FastAPI, APIRouter
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
from datetime import datetime, timezone
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


def generate_referral_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


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


class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    first_name: str
    referral_code: str
    referral_count: int
    position: int


class ReferralStats(BaseModel):
    referral_code: str
    referral_count: int
    position: int
    referral_link: str


@api_router.get("/")
async def root():
    return {"message": "Valuevade API"}


@api_router.post("/waitlist", response_model=WaitlistResponse)
async def join_waitlist(entry: WaitlistCreate):
    existing = await db.waitlist.find_one({"email": entry.email}, {"_id": 0})
    if existing:
        # Ensure existing entries have required fields for response model
        if "referral_code" not in existing:
            referral_code = generate_referral_code()
            while await db.waitlist.find_one({"referral_code": referral_code}):
                referral_code = generate_referral_code()
            existing["referral_code"] = referral_code
        if "referral_count" not in existing:
            existing["referral_count"] = 0
        
        # Update the existing entry with missing fields
        await db.waitlist.update_one(
            {"email": entry.email},
            {"$set": {
                "referral_code": existing["referral_code"],
                "referral_count": existing["referral_count"]
            }}
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

    # Credit the referrer
    if entry.ref_code:
        referrer = await db.waitlist.find_one({"referral_code": entry.ref_code})
        if referrer:
            new_position = max(1, referrer["position"] - 5)
            await db.waitlist.update_one(
                {"referral_code": entry.ref_code},
                {
                    "$inc": {"referral_count": 1},
                    "$set": {"position": new_position},
                },
            )

    return doc


@api_router.get("/waitlist/count")
async def get_waitlist_count():
    count = await db.waitlist.count_documents({})
    return {"count": count + 500}


@api_router.get("/waitlist/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard():
    cursor = db.waitlist.find(
        {"referral_count": {"$gt": 0}},
        {"_id": 0, "first_name": 1, "referral_code": 1, "referral_count": 1, "position": 1},
    ).sort("referral_count", -1).limit(10)
    entries = await cursor.to_list(10)
    return entries


@api_router.get("/waitlist/stats/{referral_code}", response_model=ReferralStats)
async def get_referral_stats(referral_code: str):
    entry = await db.waitlist.find_one({"referral_code": referral_code}, {"_id": 0})
    if not entry:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Referral code not found")
    return {
        "referral_code": entry["referral_code"],
        "referral_count": entry.get("referral_count", 0),
        "position": entry["position"],
        "referral_link": f"?ref={entry['referral_code']}",
    }


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
