import os
import re
import io
import logging
import zipfile
import asyncio
from uuid import uuid4
from urllib.parse import quote
from fastapi import HTTPException, UploadFile
import httpx
from enterprise_common import supabase_url, storage_headers

BUCKET = 'paid-resources'
FILE_TYPES = {'.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 '.xls':'application/vnd.ms-excel',
 '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 '.zip':'application/zip','.csv':'text/csv','.txt':'text/plain','.md':'text/markdown'}

def validate_content(extension, content):
    try:
        if extension == '.pdf':
            from pypdf import PdfReader
            if not content.startswith(b'%PDF-'):
                raise ValueError()
            pdf = PdfReader(io.BytesIO(content))
            if pdf.is_encrypted or not len(pdf.pages):
                raise ValueError()
        elif extension in ('.xlsx', '.docx', '.zip'):
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                files = archive.infolist()
                if len(files) > 10000 or sum(f.file_size for f in files) > 150 * 1024 * 1024:
                    raise ValueError()
                if any(f.flag_bits & 1 for f in files) or archive.testzip():
                    raise ValueError()
                required = {'[Content_Types].xml', 'xl/workbook.xml'} if extension == '.xlsx' else {'[Content_Types].xml', 'word/document.xml'}
                if extension != '.zip' and not required.issubset(archive.namelist()):
                    raise ValueError()
            if extension == '.xlsx':
                from openpyxl import load_workbook
                book = load_workbook(io.BytesIO(content), read_only=True)
                try:
                    if not book.sheetnames:
                        raise ValueError()
                finally:
                    book.close()
        elif extension == '.xls':
            import olefile
            with olefile.OleFileIO(io.BytesIO(content)) as book:
                if not (book.exists('Workbook') or book.exists('Book')):
                    raise ValueError()
        else:
            content.decode('utf-8-sig')
    except Exception:
        raise HTTPException(415, 'Invalid or password-protected file. Upload a valid, unencrypted document.')


async def upload_resource(resource_id, file: UploadFile):
    name = re.sub(r'[^a-zA-Z0-9._ -]','_',os.path.basename(file.filename or ''))[:160]
    extension = os.path.splitext(name)[1].lower()
    if extension not in FILE_TYPES:
        raise HTTPException(415,'Choose PDF, XLSX, XLS, DOCX, CSV, TXT, MD or ZIP.')
    content = await file.read(50*1024*1024+1)
    if not content or len(content)>50*1024*1024:
        raise HTTPException(413,'File must be non-empty and no larger than 50 MB.')
    await asyncio.to_thread(validate_content, extension, content)
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

async def delete_resource_file(path):
    if not path or path.startswith(('https:', 'http:')):
        return
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.request(
                'DELETE', f'{supabase_url()}/storage/v1/object/{BUCKET}',
                headers=storage_headers(), json={'prefixes': [path]})
        r.raise_for_status()
    except httpx.HTTPError:
        logging.getLogger(__name__).warning('Resource storage cleanup pending for %s', path)


async def signed_download(path, filename=None):
    if path.startswith(('https:', 'http:')):
        raise HTTPException(409, 'Please upload this resource to private storage before downloading.')
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f'{supabase_url()}/storage/v1/object/sign/{BUCKET}/{quote(path,safe="/")}',
                                 headers=storage_headers(),json={'expiresIn':120})
        if r.status_code>=300 or not r.json().get('signedURL'):
            raise HTTPException(502,'Could not prepare the download. Please retry.')
        relative = r.json()['signedURL']
        separator = '&' if '?' in relative else '?'
        return {'url':f'{supabase_url()}/storage/v1{relative}{separator}download={quote(filename or os.path.basename(path), safe="")}', 'expires_in':120}
    except httpx.RequestError:
        raise HTTPException(503,'Storage temporarily unavailable.')