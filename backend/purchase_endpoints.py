"""Read-only purchase ledger and current course bundle, scoped to the signed-in user."""
import asyncio
from fastapi import Depends, Response
from enterprise_common import rest
from resource_access import public_resource, published_resources


async def all_orders(query):
    rows, offset = [], 0
    while True:
        batch = await rest(f'{query}&order=created_at.desc&limit=500&offset={offset}')
        rows.extend(batch)
        if len(batch) < 500:
            return rows
        offset += len(batch)


def register_purchase_endpoints(router, get_user):
    @router.get('/purchases')
    async def purchases(response: Response, user=Depends(get_user)):
        response.headers['Cache-Control'] = 'private, no-store'
        uid = user['id']
        status, enrollments, course_orders, resource_orders = await asyncio.gather(
            rest(f'user_payment_status?user_id=eq.{uid}&select=paid,paid_amount_inr,paid_at,pricing_tier&limit=1'),
            rest(f'user_enrollments?user_id=eq.{uid}&status=in.(active,completed)&select=id,title,master_path_id,status'),
            all_orders(f'razorpay_orders?user_id=eq.{uid}&select=id,razorpay_order_id,amount_inr,pricing_tier,status,mock_mode,created_at'),
            all_orders(f'resource_orders?user_id=eq.{uid}&select=id,resource_id,amount_paise,status,created_at,razorpay_order_id,marketplace_resources(*)'),
        )
        status = status[0] if status else {'paid': False}
        enrolled = bool(status.get('paid'))
        included = await published_resources() if enrolled else []
        included_ids = {resource['id'] for resource in included}
        purchased = []
        seen = set()
        history = [{**o, 'id': f'course-{o["id"]}', 'kind': 'course', 'title': 'Valuevade course access',
                    'amount_paise': int(round(o['amount_inr'] * 100))} for o in course_orders]
        for order in resource_orders:
            row = order.get('marketplace_resources') or {}
            resource = public_resource(row) if row else None
            history.append({k: v for k, v in order.items() if k != 'marketplace_resources'} | {
                'id': f'resource-{order["id"]}', 'order_id': order['id'], 'kind': 'resource',
                'title': row.get('title') or 'Resource', 'mock_mode': False,
            })
            if order['status'] == 'paid' and order['resource_id'] not in seen and order['resource_id'] not in included_ids:
                seen.add(order['resource_id'])
                purchased.append({'id': order['id'], 'resource_id': order['resource_id'],
                                  'amount_paise': order['amount_paise'], 'created_at': order['created_at'],
                                  'resource': resource, 'available': bool(row.get('is_published') and resource and resource['file_available'])})
        history.sort(key=lambda o: o.get('created_at') or '', reverse=True)
        return {'is_enrolled': enrolled, 'course_access': {**status, 'enrollments': enrollments} if enrolled else None,
                'included_resources': included, 'resource_purchases': purchased, 'history': history}