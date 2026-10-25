from datetime import datetime,timezone
from uuid import UUID
from fastapi import Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, field_validator
from enterprise_common import CATEGORIES, PUBLIC_FIELDS, rest
from resource_storage import upload_resource, signed_download
from resource_payments import register_resource_payments, reconcile
from wave_endpoints import _ensure_admin

class Resource(BaseModel):
    title: str = Field(min_length=3,max_length=140)
    description: str = Field(min_length=10,max_length=6000)
    category: str
    price_paise: int = Field(ge=0,le=100000000)
    includes: list[str] = Field(default_factory=list,max_length=20)
    is_published: bool = False
    @field_validator('category')
    @classmethod
    def category_allowed(cls,v):
        if v not in CATEGORIES:
            raise ValueError('Choose an available category')
        return v
    @field_validator('title','description')
    @classmethod
    def clean_text(cls,v):
        if not v.strip():
            raise ValueError('Enter a value')
        return v.strip()
    @field_validator('includes')
    @classmethod
    def bounded_includes(cls,v):
        if any(len(x)>300 for x in v):
            raise ValueError('Each included item must be under 300 characters')
        return [x.strip() for x in v if x.strip()]

def register_resource_endpoints(router,get_user):
    # Static routes before UUID detail route.
    @router.get('/resources')
    async def catalog():
        return {'items':await rest(f'marketplace_resources?is_published=eq.true&file_path=not.is.null&select={PUBLIC_FIELDS}&order=created_at.desc&limit=500'), 'categories':CATEGORIES}

    @router.get('/resources/purchases')
    async def purchases(user=Depends(get_user)):
        return await rest(f'resource_orders?user_id=eq.{user["id"]}&select=id,resource_id,amount_paise,status,created_at,marketplace_resources(title)&order=created_at.desc&limit=500')

    @router.get('/resources/{resource_id}')
    async def detail(resource_id:UUID):
        rows=await rest(f'marketplace_resources?id=eq.{resource_id}&is_published=eq.true&file_path=not.is.null&select={PUBLIC_FIELDS}')
        if not rows:
            raise HTTPException(404,'Resource not found.')
        return rows[0]

    @router.post('/resources/{resource_id}/download')
    async def download(resource_id:UUID,user=Depends(get_user)):
        rows=await rest(f'marketplace_resources?id=eq.{resource_id}&select=*')
        if not rows or not rows[0].get('file_path'):
            raise HTTPException(404,'Resource unavailable.')
        resource=rows[0]
        orders=await rest(f'resource_orders?resource_id=eq.{resource_id}&user_id=eq.{user["id"]}&status=eq.paid&select=*&limit=1')
        if not (resource['price_paise']==0 and resource['is_published']):
            if not orders:
                raise HTTPException(403,'Purchase this resource to download it.')
            await reconcile(orders[0],orders[0]['razorpay_payment_id'])
        return await signed_download(resource['file_path'])

    @router.get('/admin/resources')
    async def admin_list(user=Depends(get_user)):
        _ensure_admin(user)
        return await rest('marketplace_resources?select=*&order=created_at.desc&limit=500')

    @router.post('/admin/resources',status_code=201)
    async def create(body:Resource,user=Depends(get_user)):
        _ensure_admin(user)
        if body.is_published:
            raise HTTPException(400,'Save a draft and upload its file before publishing.')
        return (await rest('marketplace_resources','POST',body.model_dump()))[0]

    @router.put('/admin/resources/{resource_id}')
    async def update(resource_id:UUID,body:Resource,user=Depends(get_user)):
        _ensure_admin(user)
        rows=await rest(f'marketplace_resources?id=eq.{resource_id}&select=file_path')
        if not rows:
            raise HTTPException(404,'Resource not found.')
        if body.is_published and not rows[0].get('file_path'):
            raise HTTPException(400,'Upload the downloadable file before publishing.')
        return (await rest(f'marketplace_resources?id=eq.{resource_id}','PATCH',
            {**body.model_dump(),'updated_at':datetime.now(timezone.utc).isoformat()}))[0]

    @router.post('/admin/resources/{resource_id}/file')
    async def upload(resource_id:UUID,file:UploadFile=File(...),user=Depends(get_user)):
        _ensure_admin(user)
        if not await rest(f'marketplace_resources?id=eq.{resource_id}&select=id'):
            raise HTTPException(404,'Save the resource before uploading.')
        meta=await upload_resource(str(resource_id),file)
        return (await rest(f'marketplace_resources?id=eq.{resource_id}','PATCH',meta))[0]

    register_resource_payments(router,get_user)