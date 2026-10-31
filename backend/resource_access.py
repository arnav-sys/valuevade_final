"""Shared entitlement reads; browser caches never authorize downloads."""
from enterprise_common import PUBLIC_FIELDS, rest


async def is_enrolled(user_id):
    rows = await rest(f'user_payment_status?user_id=eq.{user_id}&select=paid&limit=1')
    return bool(rows and rows[0].get('paid'))


def public_resource(row):
    result = {key: row.get(key) for key in PUBLIC_FIELDS.split(',')}
    files = sorted(row.get('resource_files') or [], key=lambda f: f.get('created_at') or '')
    result['files'] = [{'id': f['id'], 'file_name': f['file_name'], 'file_size': f['file_size'], 'file_type': f['file_type']} for f in files]
    result['file_available'] = bool(result['files'])
    return result


async def published_resources():
    rows = await rest(f'marketplace_resources?is_published=eq.true&select={PUBLIC_FIELDS},resource_files(id,file_name,file_size,file_type,created_at)&order=created_at.desc&limit=500')
    return [public_resource(row) for row in rows]