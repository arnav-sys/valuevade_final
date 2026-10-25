"""Shared server-only Supabase access for the isolated enterprise expansion."""
import os
import httpx
from fastapi import HTTPException

CATEGORIES = ['Excel financial models', 'Equity research report templates', 'AI prompt packs',
              'Sector study frameworks', 'Interview prep kits']
SAMPLE_PRICING = {'sample': True, 'currency': 'INR', 'slabs': [
    {'max_seats': 10, 'price_inr': 4999}, {'max_seats': 50, 'price_inr': 3999},
    {'max_seats': 200, 'price_inr': 2999}, {'max_seats': 1000, 'price_inr': 2499}]}
PUBLIC_FIELDS = 'id,title,description,category,price_paise,includes,file_name,file_size,file_type,created_at'

def storage_headers():
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    return {'apikey': key, 'Authorization': f'Bearer {key}'}

def supabase_url():
    return os.environ['REACT_APP_SUPABASE_URL'].rstrip('/')

async def rest(path, method='GET', data=None):
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(method, f'{supabase_url()}/rest/v1/{path}',
                headers={**storage_headers(), 'Prefer': 'return=representation'}, json=data)
        if response.status_code >= 400:
            code = response.json().get('code', '')
            if code in ('PGRST205', '42P01', 'PGRST204'):
                raise HTTPException(503, 'Enterprise database setup is pending. Contact info@valuevade.com.')
            if response.status_code == 409:
                raise HTTPException(409, 'This record already exists. Refresh to see the saved version.')
            raise HTTPException(502, 'Could not save or load data. Please retry.')
        return response.json() if response.content else []
    except httpx.RequestError:
        raise HTTPException(503, 'Database temporarily unavailable. Please retry.')

async def readiness():
    try:
        for table in ('enterprise_leads','marketplace_resources','resource_orders'):
            await rest(f'{table}?select=id&limit=0')
        return True
    except HTTPException:
        return False

async def pricing():
    rows = await rest('app_settings?key=eq.enterprise_pricing&select=value_json')
    return rows[0]['value_json'] if rows else SAMPLE_PRICING

def quote_price(seats, config):
    # Volume slab pricing: one applicable per-seat rate for the entire team.
    slab = next(s for s in config['slabs'] if seats <= s['max_seats'])
    return {'seats': seats, 'per_seat_inr': slab['price_inr'],
            'total_inr': seats * slab['price_inr'], 'currency': 'INR', 'sample': config['sample']}