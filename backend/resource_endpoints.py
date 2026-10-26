from datetime import datetime, timezone
from urllib.parse import quote
from uuid import UUID
from fastapi import Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, field_validator
from enterprise_common import CATEGORIES, rest
from resource_access import is_enrolled, public_resource, published_resources
from resource_storage import upload_resource, signed_download, delete_resource_file
from resource_payments import register_resource_payments, reconcile
from purchase_endpoints import register_purchase_endpoints
from wave_endpoints import _ensure_admin


class Resource(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=10, max_length=6000)
    category: str
    price_paise: int = Field(ge=0, le=100000000)
    includes: list[str] = Field(default_factory=list, max_length=20)
    is_published: bool = False

    @field_validator('category')
    @classmethod
    def category_allowed(cls, value):
        if value not in CATEGORIES:
            raise ValueError('Choose an available category')
        return value

    @field_validator('title', 'description')
    @classmethod
    def clean_text(cls, value):
        if not value.strip():
            raise ValueError('Enter a value')
        return value.strip()

    @field_validator('includes')
    @classmethod
    def bounded_includes(cls, value):
        if any(len(x) > 300 for x in value):
            raise ValueError('Each included item must be under 300 characters')
        return [x.strip() for x in value if x.strip()]


def register_resource_endpoints(router, get_user):
    @router.get('/resources')
    async def catalog():
        return {'items': await published_resources(), 'categories': CATEGORIES}

    @router.get('/resources/my-library')
    async def my_library(user=Depends(get_user)):
        enrolled = await is_enrolled(user['id'])
        orders = await rest(f'resource_orders?user_id=eq.{user["id"]}&select=id,resource_id,amount_paise,status,created_at,marketplace_resources(title,category,file_type,file_size,file_name)&order=created_at.desc&limit=500')
        return {'resources': await published_resources() if enrolled else [], 'orders': orders,
                'access_type': 'enrolled' if enrolled else 'purchased', 'has_access': enrolled}

    @router.get('/resources/purchases')
    async def purchases(user=Depends(get_user)):
        return await rest(f'resource_orders?user_id=eq.{user["id"]}&select=id,resource_id,amount_paise,status,created_at,marketplace_resources(title)&order=created_at.desc&limit=500')

    @router.get('/resources/{resource_id}')
    async def detail(resource_id: UUID):
        rows = await rest(f'marketplace_resources?id=eq.{resource_id}&is_published=eq.true&select=*')
        if not rows:
            raise HTTPException(404, 'Resource not found.')
        return public_resource(rows[0])

    @router.get('/resources/{resource_id}/sample')
    async def sample_file(resource_id: UUID, user=Depends(get_user)):
        raise HTTPException(410, 'Sample downloads have been retired. The real file will appear when uploaded.')

    @router.post('/resources/{resource_id}/download')
    async def download(resource_id: UUID, user=Depends(get_user)):
        rows = await rest(f'marketplace_resources?id=eq.{resource_id}&select=*')
        if not rows or not rows[0].get('is_published'):
            raise HTTPException(404, 'Resource not available.')
        resource = rows[0]
        if not await is_enrolled(user['id']):
            orders = await rest(f'resource_orders?resource_id=eq.{resource_id}&user_id=eq.{user["id"]}&status=eq.paid&select=*&limit=1')
            if not orders:
                raise HTTPException(403, 'Enrol in a Valuevade course or purchase this resource to download it.')
            await reconcile(orders[0], orders[0]['razorpay_payment_id'])
        if not public_resource(resource)['file_available']:
            raise HTTPException(409, 'File coming soon. Your access is saved; check back after the file is uploaded.')
        return await signed_download(resource['file_path'], resource['file_name'])

    @router.get('/admin/resources')
    async def admin_list(user=Depends(get_user)):
        _ensure_admin(user)
        return await rest('marketplace_resources?select=*&order=created_at.desc&limit=500')

    @router.post('/admin/resources', status_code=201)
    async def create(body: Resource, user=Depends(get_user)):
        _ensure_admin(user)
        return (await rest('marketplace_resources', 'POST', body.model_dump()))[0]

    @router.put('/admin/resources/{resource_id}')
    async def update(resource_id: UUID, body: Resource, user=Depends(get_user)):
        _ensure_admin(user)
        rows = await rest(f'marketplace_resources?id=eq.{resource_id}', 'PATCH',
                          {**body.model_dump(), 'updated_at': datetime.now(timezone.utc).isoformat()})
        if not rows:
            raise HTTPException(404, 'Resource not found.')
        return rows[0]

    @router.post('/admin/resources/{resource_id}/file')
    async def upload(resource_id: UUID, file: UploadFile = File(...), user=Depends(get_user)):
        _ensure_admin(user)
        rows = await rest(f'marketplace_resources?id=eq.{resource_id}&select=file_path')
        if not rows:
            raise HTTPException(404, 'Save the resource before uploading.')
        old_path = rows[0].get('file_path')
        meta = await upload_resource(str(resource_id), file)
        predicate = f'eq.{quote(old_path, safe="")}' if old_path else 'is.null'
        try:
            saved = await rest(f'marketplace_resources?id=eq.{resource_id}&file_path={predicate}', 'PATCH',
                               {**meta, 'updated_at': datetime.now(timezone.utc).isoformat()})
            if not saved:
                raise HTTPException(409, 'The file changed in another window. Reopen this resource and try again.')
        except Exception:
            # A timeout may have happened after commit. Never remove a referenced file.
            current = await rest(f'marketplace_resources?id=eq.{resource_id}&select=*')
            if current and current[0].get('file_path') == meta['file_path']:
                return current[0]
            await delete_resource_file(meta['file_path'])
            raise
        if old_path:
            await delete_resource_file(old_path)
        return saved[0]

    register_resource_payments(router, get_user)
    register_purchase_endpoints(router, get_user)