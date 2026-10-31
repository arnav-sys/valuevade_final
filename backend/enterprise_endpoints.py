"""Enterprise pricing, saved enquiries and admin setup. Existing auth is reused unchanged."""
import time
import re
from collections import OrderedDict
from pathlib import Path
from typing import Literal
from uuid import UUID
from fastapi import Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator, model_validator
from enterprise_common import rest, readiness, pricing, quote_price
from enterprise_email import notify_owner, email_configured
from wave_endpoints import _ensure_admin

_requests = OrderedDict()

def limit_request(request):
    # Bounded abuse protection; never trust a browser-supplied forwarding header.
    key = request.client.host if request.client else 'unknown'
    now = time.monotonic()
    recent = [t for t in _requests.get(key, []) if now-t < 60]
    if len(recent) >= 5:
        raise HTTPException(429, 'Please wait a minute before trying again.')
    _requests[key] = recent + [now]
    _requests.move_to_end(key)
    while len(_requests) > 5000:
        _requests.popitem(last=False)

class Lead(BaseModel):
    id: UUID
    name: str = Field(min_length=2,max_length=100)
    email: str = Field(max_length=254)
    company: str = Field(min_length=2,max_length=160)
    seats: int = Field(ge=1,le=1000)
    interest: Literal['training','agents','both']
    requirements: str = Field(min_length=10,max_length=3000)
    consent: Literal[True]
    website: str = Field(default='',max_length=200)
    @field_validator('name','company','requirements')
    @classmethod
    def trim_nonempty(cls,v):
        if len(v.strip()) < 2:
            raise ValueError('Please enter a value')
        return v.strip()
    @field_validator('email')
    @classmethod
    def valid_email(cls,v):
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',v.strip()):
            raise ValueError('Please enter a valid email')
        return v.strip().lower()

class Slab(BaseModel):
    max_seats: int = Field(ge=1,le=1000)
    price_inr: int = Field(ge=1,le=1000000)

class Pricing(BaseModel):
    sample: bool
    currency: Literal['INR'] = 'INR'
    slabs: list[Slab] = Field(min_length=1,max_length=8)
    @model_validator(mode='after')
    def ascending(self):
        ends = [s.max_seats for s in self.slabs]
        if ends != sorted(set(ends)) or ends[-1] != 1000:
            raise ValueError('Slabs must increase and end at 1000 seats')
        return self

class LeadStatus(BaseModel):
    status: Literal['new','contacted','qualified','closed']

def register_enterprise_endpoints(router, get_user):
    @router.get('/enterprise/config')
    async def config():
        return {'pricing': await pricing(), 'enquiries_available':await readiness()}

    @router.post('/enterprise/enquiries',status_code=201)
    async def create_lead(body: Lead, request: Request):
        limit_request(request)
        if body.website:
            raise HTTPException(400,'Unable to submit this enquiry.')
        data = body.model_dump(mode='json',exclude={'website'})
        data['estimate'] = ({'seats':body.seats,'currency':'INR','quote_type':'scope_based','sample':False}
                            if body.interest=='agents' else quote_price(body.seats, await pricing()))
        # Client-generated UUID makes a retry safe without duplicating owner notifications.
        prior = await rest(f'enterprise_leads?id=eq.{body.id}&select=id&limit=1')
        if prior:
            return {'saved':True, 'reference':str(body.id)}
        await rest('enterprise_leads','POST',data)
        delivery = await notify_owner(body.id)
        await rest(f'enterprise_leads?id=eq.{body.id}','PATCH',delivery)
        return {'saved':True,'reference':str(body.id),'notification':delivery['email_status']}

    @router.get('/admin/enterprise/status')
    async def setup_status(user=Depends(get_user)):
        _ensure_admin(user)
        return {'database_ready':await readiness(),'email_configured':email_configured()}

    @router.get('/admin/enterprise/setup.sql')
    async def setup_sql(user=Depends(get_user)):
        _ensure_admin(user)
        migrations = Path(__file__).parent.parent/'scripts/migrations'
        sql = '\n\n'.join((migrations/f).read_text() for f in ('0048_enterprise_resources.sql','0049_resource_files.sql'))
        return Response(sql,media_type='text/plain',headers={'Content-Disposition':'attachment; filename=valuevade-enterprise.sql'})

    @router.put('/admin/enterprise/pricing')
    async def update_pricing(body: Pricing,user=Depends(get_user)):
        _ensure_admin(user)
        rows=await rest('app_settings?key=eq.enterprise_pricing&select=key')
        if rows:
            await rest('app_settings?key=eq.enterprise_pricing','PATCH',{'value_json':body.model_dump()})
        else:
            await rest('app_settings','POST',{'key':'enterprise_pricing','value_json':body.model_dump()})
        return body

    @router.get('/admin/enterprise/leads')
    async def leads(user=Depends(get_user)):
        _ensure_admin(user)
        return await rest('enterprise_leads?select=*&order=created_at.desc&limit=500')

    @router.patch('/admin/enterprise/leads/{lead_id}')
    async def update_lead(lead_id:UUID,body:LeadStatus,user=Depends(get_user)):
        _ensure_admin(user)
        result=await rest(f'enterprise_leads?id=eq.{lead_id}','PATCH',body.model_dump())
        if not result:
            raise HTTPException(404,'Enquiry not found')
        return result[0]

    @router.post('/admin/enterprise/leads/{lead_id}/notify')
    async def retry_notification(lead_id:UUID,request:Request,user=Depends(get_user)):
        _ensure_admin(user)
        limit_request(request)
        rows=await rest(f'enterprise_leads?id=eq.{lead_id}&select=id,email_status')
        if not rows:
            raise HTTPException(404,'Enquiry not found')
        if rows[0]['email_status']=='accepted':
            return {'email_status':'accepted'}
        result=await notify_owner(lead_id)
        await rest(f'enterprise_leads?id=eq.{lead_id}','PATCH',result)
        return result