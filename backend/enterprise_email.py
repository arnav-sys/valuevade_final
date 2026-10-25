"""Fixed owner notifications; never an open recipient/body email endpoint."""
import os
import re
import ipaddress
from html.parser import HTMLParser
from html import escape
from urllib.parse import urlparse
import httpx

EMAIL_BASE_URL = 'https://integrations.emergentagent.com'
_SHORTENERS = ('bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'goo.gl', 'rebrand.ly')
_CRED_ASK = ('reply with your password', 'reply with the code', 'send your password', 'cvv',
 'send us your password', 'enter your password below', 'confirm your card number',
 'your full card number', 'seed phrase', 'recovery phrase', 'verify your card',
 'social security number', 'confirm your bank details')
_HOSTISH = re.compile(r'\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})', re.I)

def _host_ok(host):
    if not host or 'xn--' in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith('.' + s) for s in _SHORTENERS)

def _same_site(shown, real):
    return shown == real or real.endswith('.' + shown) or shown.endswith('.' + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k,v in attrs if k.lower() in ('href','src') and v]
        if tag.lower() == 'a':
            self._href = dict((k.lower(),v) for k,v in attrs).get('href')
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == 'a' and self._href is not None:
            self.anchors.append((self._href, ''.join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject, html):
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {'form','input','textarea','select'}:
        raise ValueError('No forms or input fields in email (G2)')
    body = f'{subject}\n{html}'.lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f'Email asks the recipient for credentials: {p!r} (G2)')
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(('mailto:','tel:','cid:','#')):
            continue
        if not low.startswith('https://'):
            raise ValueError(f'Email links/assets must be absolute https: {url!r} (G3)')
        host = urlparse(low).hostname or ''
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f'Shortened, numeric-host or credential-bearing URL: {url!r} (G3)')
    for href,text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ''
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(),real):
                raise ValueError(f'Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)')

def email_configured():
    return bool(os.environ.get('EMERGENT_EMAIL_KEY') and os.environ.get('EMAIL_FROM_NAME'))

async def notify_owner(lead_id):
    if not email_configured():
        return {'email_status': 'not_configured'}
    # Only a persisted UUID, never user-authored text, is interpolated into the notification.
    subject = 'New Valuevade enterprise enquiry'
    html = ('<h1>Valuevade</h1><p>A new enterprise enquiry is ready in your admin panel.</p>'
            f'<p>Reference: {escape(str(lead_id))}</p><p>Open Valuevade → Admin → Enterprise to review it.</p>'
            '<p>Valuevade · Enterprise enquiries</p>')
    _assert_safe_email(subject, html)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f'{EMAIL_BASE_URL}/api/v1/email/send',
                headers={'X-Email-Key': os.environ['EMERGENT_EMAIL_KEY']},
                json={'to':['info@valuevade.com'], 'subject':subject, 'html':html,
                      'from_name':os.environ['EMAIL_FROM_NAME']})
        if r.status_code == 202 and r.json().get('id'):
            return {'email_status':'accepted', 'email_id':r.json()['id']}
        return {'email_status':'failed'}
    except httpx.RequestError:
        return {'email_status':'failed'}