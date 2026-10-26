"""Shared entitlement reads; browser caches never authorize downloads."""
from enterprise_common import PUBLIC_FIELDS, rest


async def is_enrolled(user_id):
    rows = await rest(f'user_payment_status?user_id=eq.{user_id}&select=paid&limit=1')
    return bool(rows and rows[0].get('paid'))


def public_resource(row):
    result = {key: row.get(key) for key in PUBLIC_FIELDS.split(',')}
    path = row.get('file_path') or ''
    result['file_available'] = bool(path and row.get('file_name') and not path.startswith(('http:', 'https:')))
    return result


async def published_resources():
    rows = await rest(f'marketplace_resources?is_published=eq.true&select={PUBLIC_FIELDS},file_path&order=created_at.desc&limit=500')
    return [public_resource(row) for row in rows]