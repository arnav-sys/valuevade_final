import os
import re
from uuid import uuid4
from urllib.parse import quote
from fastapi import HTTPException, UploadFile
import httpx
from enterprise_common import supabase_url, storage_headers

BUCKET = 'paid-resources'
FILE_TYPES = {'.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 '.zip':'application/zip','.csv':'text/csv','.txt':'text/plain','.md':'text/markdown'}

async def upload_resource(resource_id, file: UploadFile):
    name = re.sub(r'[^a-zA-Z0-9._ -]','_',os.path.basename(file.filename or ''))[:160]
    extension = os.path.splitext(name)[1].lower()
    if extension not in FILE_TYPES:
        raise HTTPException(415,'Choose PDF, XLSX, DOCX, CSV, TXT, MD or ZIP.')
    content = await file.read(25*1024*1024+1)
    if not content or len(content)>25*1024*1024:
        raise HTTPException(413,'File must be non-empty and no larger than 25 MB.')
    if extension=='.pdf' and not content.startswith(b'%PDF-'):
        raise HTTPException(415,'The file is not a valid PDF.')
    if extension in ('.xlsx','.docx','.zip') and not content.startswith(b'PK'):
        raise HTTPException(415,'Invalid document archive.')
    if extension in ('.csv','.txt','.md'):
        try:
            content.decode('utf-8-sig')
        except UnicodeDecodeError:
            raise HTTPException(415,'Text files must use UTF-8 encoding.')
    path = f'{resource_id}/{uuid4().hex}/{name}'
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f'{supabase_url()}/storage/v1/object/{BUCKET}/{quote(path,safe="/")}',
                headers={**storage_headers(),'Content-Type':FILE_TYPES[extension],'x-upsert':'false'},content=content)
        if r.status_code>=300:
            raise HTTPException(502,'Private storage upload failed. Check database setup, then retry.')
    except httpx.RequestError:
        raise HTTPException(503,'Storage temporarily unavailable.')
    return {'file_path':path,'file_name':name,'file_size':len(content),'file_type':extension[1:].upper()}

async def signed_download(path):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f'{supabase_url()}/storage/v1/object/sign/{BUCKET}/{quote(path,safe="/")}',
                                 headers=storage_headers(),json={'expiresIn':120})
        if r.status_code>=300 or not r.json().get('signedURL'):
            raise HTTPException(502,'Could not prepare the download. Please retry.')
        relative = r.json()['signedURL']
        return {'url':f'{supabase_url()}/storage/v1{relative}&download=', 'expires_in':120}
    except httpx.RequestError:
        raise HTTPException(503,'Storage temporarily unavailable.')