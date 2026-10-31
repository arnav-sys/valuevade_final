"""Isolated resource transactions: never grant or modify course entitlements."""
import asyncio
import hashlib
import hmac
import os
from datetime import datetime,timezone
from uuid import UUID, uuid4
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from payment_endpoints import _razor
from enterprise_common import rest
from resource_access import is_enrolled

class VerifyResource(BaseModel):
    razorpay_order_id: str = Field(pattern=r'^order_[A-Za-z0-9]+$',max_length=100)
    razorpay_payment_id: str = Field(pattern=r'^pay_[A-Za-z0-9]+$',max_length=100)
    razorpay_signature: str = Field(pattern=r'^[a-f0-9]{64}$')

async def gateway(fn,*args):
    if not os.environ.get('RAZORPAY_KEY_ID') or not os.environ.get('RAZORPAY_KEY_SECRET'):
        raise HTTPException(503,'Payments are currently unavailable.')
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn,*args),timeout=25)
    except Exception:
        raise HTTPException(502,'Payment provider unavailable. No access has been granted; please retry.')

async def reconcile(order,payment_id):
    payment = await gateway(_razor().payment.fetch,payment_id)
    if (payment.get('order_id') != order['razorpay_order_id'] or
        payment.get('amount') != order['amount_paise'] or payment.get('currency') != 'INR'):
        raise HTTPException(400,'Payment does not match this purchase.')
    if payment.get('amount_refunded',0)>0 or payment.get('status')=='refunded':
        await rest(f'resource_orders?id=eq.{order["id"]}','PATCH',{'status':'refunded'})
        raise HTTPException(403,'This purchase has been refunded.')
    if payment.get('status') != 'captured':
        raise HTTPException(409,'Payment is not captured yet. Use Check payment in your downloads to retry.')
    await rest(f'resource_orders?id=eq.{order["id"]}&status=eq.created','PATCH',
        {'status':'paid','razorpay_payment_id':payment_id,'paid_at':datetime.now(timezone.utc).isoformat()})
    return {'paid':True,'resource_id':order['resource_id']}

async def order_for_user(order_id,user_id):
    rows=await rest(f'resource_orders?razorpay_order_id=eq.{order_id}&user_id=eq.{user_id}&select=*')
    if not rows:
        raise HTTPException(404,'Purchase not found.')
    return rows[0]

def register_resource_payments(router,get_user):
    @router.post('/resources/{resource_id}/order')
    async def create_order(resource_id:UUID,user=Depends(get_user)):
        rows=await rest(f'marketplace_resources?id=eq.{resource_id}&is_published=eq.true&select=*,resource_files(id)')
        if not rows:
            raise HTTPException(404,'This resource is not available for purchase.')
        item=rows[0]
        if await is_enrolled(user['id']):
            return {'owned': True, 'included_in_course': True}
        if not item.get('resource_files'):
            raise HTTPException(409, 'File coming soon. This resource cannot be purchased yet.')
        owned=await rest(f'resource_orders?user_id=eq.{user["id"]}&resource_id=eq.{resource_id}&status=eq.paid&select=id&limit=1')
        if owned:
            return {'owned':True}
        if item['price_paise']<=0:
            raise HTTPException(403, 'This resource is included with course enrolment.')
        pending=await rest(f'resource_orders?user_id=eq.{user["id"]}&resource_id=eq.{resource_id}&amount_paise=eq.{item["price_paise"]}&status=eq.created&razorpay_order_id=not.is.null&select=*&order=created_at.desc&limit=1')
        if pending:
            order=pending[0]
        else:
            order={'id':str(uuid4()),'user_id':user['id'],'resource_id':str(resource_id),'amount_paise':item['price_paise']}
            await rest('resource_orders','POST',order)
            razor=await gateway(_razor().order.create,{'amount':item['price_paise'],'currency':'INR','receipt':order['id']})
            order['razorpay_order_id']=razor['id']
            await rest(f'resource_orders?id=eq.{order["id"]}','PATCH',{'razorpay_order_id':razor['id']})
        return {'order_id':order['razorpay_order_id'],'amount':order['amount_paise'],'currency':'INR',
                'key_id':os.environ['RAZORPAY_KEY_ID'],'test_mode':os.environ['RAZORPAY_KEY_ID'].startswith('rzp_test_')}

    @router.post('/resources/payment/verify')
    async def verify(body:VerifyResource,user=Depends(get_user)):
        order=await order_for_user(body.razorpay_order_id,user['id'])
        expected=hmac.new(os.environ['RAZORPAY_KEY_SECRET'].encode(),
            f'{order["razorpay_order_id"]}|{body.razorpay_payment_id}'.encode(),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected,body.razorpay_signature):
            raise HTTPException(400,'Invalid payment signature.')
        return await reconcile(order,body.razorpay_payment_id)

    @router.post('/resources/purchases/{order_id}/check')
    async def check_payment(order_id:UUID,user=Depends(get_user)):
        rows=await rest(f'resource_orders?id=eq.{order_id}&user_id=eq.{user["id"]}&select=*')
        if not rows or not rows[0].get('razorpay_order_id'):
            raise HTTPException(404,'Purchase not found.')
        order=rows[0]
        payments=await gateway(_razor().order.payments,order['razorpay_order_id'])
        for payment in payments.get('items',[]):
            if payment['status']=='captured':
                return await reconcile(order,payment['id'])
        raise HTTPException(409,'No captured payment yet. If you were charged, please wait and check again.')

    @router.post('/resources/payment/webhook')
    async def webhook(request:Request):
        secret=os.environ.get('RAZORPAY_WEBHOOK_SECRET')
        if not secret:
            raise HTTPException(503,'Webhook is not configured.')
        raw=await request.body()
        expected=hmac.new(secret.encode(),raw,hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected,request.headers.get('X-Razorpay-Signature','')):
            raise HTTPException(400,'Invalid signature.')
        payload=await request.json()
        entity=payload.get('payload',{}).get('payment',{}).get('entity',{})
        oid=entity.get('order_id')
        if oid and isinstance(oid,str) and oid.startswith('order_'):
            from urllib.parse import quote
            rows=await rest(f'resource_orders?razorpay_order_id=eq.{quote(oid,safe="")}&select=*')
            if rows:
                try:
                    await reconcile(rows[0],entity['id'])
                except HTTPException as exc:
                    if exc.status_code not in (403,409):
                        raise
        return {'received':True}