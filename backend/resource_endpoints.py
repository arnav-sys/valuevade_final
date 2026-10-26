from datetime import datetime,timezone
from uuid import UUID
import csv, io
from fastapi import Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from enterprise_common import CATEGORIES, PUBLIC_FIELDS, rest
from resource_storage import upload_resource, signed_download
from resource_payments import register_resource_payments, reconcile
from wave_endpoints import _ensure_admin

# ---------------------------------------------------------------------------
# Sample CSV templates generated on-the-fly for enrolled users when a real
# file hasn't been uploaded yet. Maps CATEGORIES → list of (header, rows).
# ---------------------------------------------------------------------------
_SAMPLE_DATA = {
    'Excel financial models': {
        'filename': 'dcf_model_template.csv',
        'headers': ['Year','Revenue (INR Cr)','COGS','Gross Profit','EBITDA','Depreciation','EBIT','Tax @25%','NOPAT','CapEx','Free Cash Flow','Discount Factor @12%','PV of FCF'],
        'rows': [
            ['FY25','100','60','40','22','5','17','4.25','12.75','8','4.75','0.893','4.24'],
            ['FY26','120','70','50','28','5','23','5.75','17.25','9','8.25','0.797','6.58'],
            ['FY27','145','84','61','34','6','28','7','21','10','11','0.712','7.83'],
            ['FY28','175','101','74','42','6','36','9','27','12','15','0.636','9.54'],
            ['FY29','210','120','90','51','7','44','11','33','14','19','0.567','10.77'],
        ],
        'note': 'Valuevade DCF Model Template — Fill in your own assumptions. See Notes tab for instructions.',
    },
    'Equity research report templates': {
        'filename': 'equity_research_template.csv',
        'headers': ['Section','Sub-section','Key Data Points','Analyst Notes','Source'],
        'rows': [
            ['Company Overview','Business Model','Revenue streams, segment mix, key products','Describe core operations','Annual Report / Concall'],
            ['Company Overview','Management Quality','Promoter holding %, board composition','Check alignment with minority shareholders','BSE Filings'],
            ['Industry Analysis','Market Size','TAM, SAM, SOM in INR Cr','Use CAGR, segments','Industry Report'],
            ['Financials','Revenue CAGR 3Y','Enter %','Organic vs inorganic','MCA / Screener'],
            ['Financials','EBITDA Margin','Enter %','Trend analysis critical','Quarterly results'],
            ['Valuation','EV/EBITDA','Enter x','Compare to 3-5Y avg and peers','NSE / BSE'],
            ['Valuation','P/E','Enter x','Premium / discount justification','Bloomberg / Screener'],
            ['Recommendation','Rating','BUY / HOLD / SELL','One-liner thesis','Own analysis'],
            ['Recommendation','Target Price (INR)','Enter price','12-month DCF/multiple blended','Own analysis'],
        ],
        'note': 'Valuevade Equity Research Template — Replace bracketed text with real company data.',
    },
    'AI prompt packs': {
        'filename': 'finance_ai_prompts.csv',
        'headers': ['Category','Prompt Title','Use Case','Prompt (copy & paste)','Tips'],
        'rows': [
            ['Valuation','Quick DCF Sanity Check','Stress-test a valuation before a call','You are a senior equity analyst. Review this DCF [paste model summary]. Identify the 3 most aggressive assumptions and suggest a bear-case adjustment for each.','Start with bear case assumptions'],
            ['Research','Management Commentary Decoder','Extract tone from an earnings call transcript','Analyse this earnings call transcript [paste]. Identify: (1) Topics management emphasised vs. deflected (2) Changes in language vs. last quarter (3) Any guidance revision embedded in the language.','Works best with full transcript'],
            ['Interview Prep','Stock Pitch Reviewer','Sharpen your buy/sell thesis','I am going to pitch [Stock Name]. Ask me 5 tough questions a PM would ask about the thesis, then evaluate my answers for: clarity, valuation rigour, and risk awareness.','Re-run after each answer'],
            ['Financial Modelling','Model Assumption Reviewer','Peer-review your financial model','Here are my FY26 assumptions [paste]: Revenue growth %, margins %, CapEx %. How do these compare to the historical range and listed peers for this sector? Flag any outliers.','Pair with Screener data'],
            ['Sector Study','Industry Structure Summary','Quick competitive dynamics overview','Summarise the competitive landscape of [Sector] in India using Porters Five Forces. Focus on pricing power, barriers to entry, and structural earnings quality. Max 300 words.','Good first-pass before deep dive'],
        ],
        'note': 'Valuevade AI Prompt Pack — Copy prompts into ChatGPT, Claude, or Gemini. Replace [bracketed text] with your own data.',
    },
    'Sector study frameworks': {
        'filename': 'sector_study_framework.csv',
        'headers': ['Framework Step','Question to Answer','Data Sources','Output Expected'],
        'rows': [
            ['1. Industry Overview','What does the sector do? Size? Growth rate?','IBEF, Statista, Industry bodies','1-page snapshot: TAM, CAGR, key segments'],
            ['2. Demand Drivers','What macro/micro factors drive demand?','RBI reports, Ministry data, Concalls','Top 3-5 demand drivers with data'],
            ['3. Supply Structure','How many players? Market shares? Barriers?','CMIE, Annual reports, Press','Herfindahl Index / market concentration'],
            ['4. Cost Structure','Fixed vs. variable cost split? Working capital?','Listed peer analysis, CRISIL','EBITDA margin range; peer benchmarks'],
            ['5. Regulatory Environment','Key regulations, licensing, government role?','SEBI, RBI, Ministry circulars','Regulatory risk rating (Low/Medium/High)'],
            ['6. Valuation Comps','What multiple does the sector trade at? Why?','NSE/BSE, Bloomberg, Screener','EV/EBITDA, P/E range; premium/discount drivers'],
            ['7. Red Flags','What can go wrong?','Short-seller reports, News, Auditor notes','Bear case: 2-3 key risks with probability'],
        ],
        'note': 'Valuevade Sector Study Framework — Work through each step sequentially for a structured deep dive.',
    },
    'Interview prep kits': {
        'filename': 'finance_interview_prep.csv',
        'headers': ['Round','Question Category','Interview Question','Sample Strong Answer (outline)','Common Mistake to Avoid'],
        'rows': [
            ['Technical','Accounting','Walk me through the three financial statements.','Start: IS shows profitability → BS shows position → CFS reconciles both. Highlight linking items (NI to retained earnings; D&A non-cash add-back in CFS).','Forgetting to mention the linkages'],
            ['Technical','Valuation','What is DCF and when is it most/least appropriate?','DCF discounts FCFs at WACC. Best for: stable cash flows. Worst for: early-stage, cyclical, financial companies.','Saying DCF is "always the best" method'],
            ['Technical','Financial Ratios','What does a P/E ratio tell you and what doesn\'t it tell you?','Tells: earnings multiple the market pays. Doesn\'t tell: quality of earnings, leverage, or non-recurring items.','Giving a textbook def without limitations'],
            ['Fit','Story','Why finance / why this firm?','Be specific: name a deal/report/person that drew you in. Tie to this firm\'s deal flow or culture.','Generic "I have always loved numbers" answer'],
            ['Stock Pitch','Buy Thesis','Pitch me a stock.','Structure: Company (30s) → Thesis (90s, 3 reasons) → Valuation (30s) → Risk & Mitigant (30s).','Jumping to valuation before explaining the business'],
            ['Behavioural','Failure','Tell me about a time you made an error.','Situation → Your error → What you did to fix it → What you changed. Own it, don\'t deflect.','Blaming others or saying "I work too hard"'],
        ],
        'note': 'Valuevade Interview Prep Kit — Practice each question aloud before your interview. Time your answers.',
    },
}

# Map extra promise-labels (from course page) to the canonical DB categories
_LABEL_TO_CATEGORY = {
    'hr database': 'Sector study frameworks',  # HR data as a sector framework
    'financial modelling templates': 'Excel financial models',
    'equity research templates': 'Equity research report templates',
    'ai agent workflows': 'AI prompt packs',
    'prompts library': 'AI prompt packs',
    'finance project templates': 'Excel financial models',
    'interview-prep templates': 'Interview prep kits',
}


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


async def _is_enrolled(user_id: str) -> bool:
    """True when the user has paid and is an active enrolled student."""
    try:
        rows = await rest(f'user_payment_status?user_id=eq.{user_id}&select=paid&limit=1')
        return bool(rows and rows[0].get('paid'))
    except Exception:
        return False


def _make_sample_csv(category: str, title: str) -> bytes:
    """Return a UTF-8 CSV bytes for the given resource category."""
    data = _SAMPLE_DATA.get(category, _SAMPLE_DATA['Excel financial models'])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f'# Valuevade — {title}'])
    w.writerow([f'# Category: {category}'])
    w.writerow([f'# Note: {data["note"]}'])
    w.writerow([])
    w.writerow(data['headers'])
    for row in data['rows']:
        w.writerow(row)
    return buf.getvalue().encode('utf-8-sig')  # BOM so Excel opens cleanly


def register_resource_endpoints(router,get_user):
    # ── Public catalog ────────────────────────────────────────────────────
    # Shows all published resources; enrolled users can download even if
    # file hasn't been uploaded yet (sample CSV generated on-the-fly).
    @router.get('/resources')
    async def catalog():
        items = await rest(f'marketplace_resources?is_published=eq.true&select={PUBLIC_FIELDS}&order=created_at.desc&limit=500')
        return {'items': items, 'categories': CATEGORIES}

    # ── Enrolled-user library ─────────────────────────────────────────────
    @router.get('/resources/my-library')
    async def my_library(user=Depends(get_user)):
        enrolled = await _is_enrolled(user['id'])
        if enrolled:
            items = await rest(f'marketplace_resources?is_published=eq.true&select={PUBLIC_FIELDS}&order=created_at.desc&limit=500')
            return {'resources': items, 'access_type': 'enrolled', 'has_access': True}
        # Not enrolled: return only individually purchased resources
        orders = await rest(
            f'resource_orders?user_id=eq.{user["id"]}&select=id,resource_id,amount_paise,'
            f'status,created_at,marketplace_resources(title,category,file_type,file_size)'
            f'&order=created_at.desc&limit=500'
        )
        return {'resources': [], 'orders': orders, 'access_type': 'purchased', 'has_access': False}

    # ── Purchases (legacy individual-buy list) ────────────────────────────
    @router.get('/resources/purchases')
    async def purchases(user=Depends(get_user)):
        return await rest(f'resource_orders?user_id=eq.{user["id"]}&select=id,resource_id,amount_paise,status,created_at,marketplace_resources(title)&order=created_at.desc&limit=500')

    # ── Public detail ─────────────────────────────────────────────────────
    @router.get('/resources/{resource_id}')
    async def detail(resource_id:UUID):
        rows=await rest(f'marketplace_resources?id=eq.{resource_id}&is_published=eq.true&select={PUBLIC_FIELDS}')
        if not rows:
            raise HTTPException(404,'Resource not found.')
        return rows[0]

    # ── Sample CSV download (enrolled users only) ─────────────────────────
    @router.get('/resources/{resource_id}/sample')
    async def sample_file(resource_id:UUID, user=Depends(get_user)):
        if not await _is_enrolled(user['id']):
            raise HTTPException(403, 'Enrol in a Valuevade course to access sample resources.')
        rows = await rest(f'marketplace_resources?id=eq.{resource_id}&is_published=eq.true&select=id,title,category')
        if not rows:
            raise HTTPException(404, 'Resource not found.')
        r = rows[0]
        content = _make_sample_csv(r.get('category','Excel financial models'), r.get('title','Template'))
        safe_title = ''.join(c if ord(c) < 128 else '_' for c in r.get('title','template'))
        safe_title = safe_title.replace(' ', '_')[:60]
        return StreamingResponse(
            io.BytesIO(content),
            media_type='text/csv',
            headers={'Content-Disposition': f'attachment; filename="{safe_title}_sample.csv"'},
        )

    # ── Download (enrolled = free; non-enrolled = purchase required) ──────
    @router.post('/resources/{resource_id}/download')
    async def download(resource_id:UUID,user=Depends(get_user)):
        rows=await rest(f'marketplace_resources?id=eq.{resource_id}&select=*')
        if not rows:
            raise HTTPException(404,'Resource not found.')
        resource=rows[0]
        if not resource.get('is_published'):
            raise HTTPException(404,'Resource not available.')

        enrolled = await _is_enrolled(user['id'])
        if enrolled:
            # Enrolled users get free access to all published resources.
            fp = resource.get('file_path')
            if fp:
                return await signed_download(fp)
            # No real file yet — return URL for the on-demand sample CSV.
            import os
            base = os.environ.get('REACT_APP_BACKEND_URL','').rstrip('/')
            return {
                'url': f'{base}/api/resources/{resource_id}/sample',
                'expires_in': 3600,
                'is_sample': True,
            }

        # Non-enrolled: check for individual purchase (or free resource).
        orders=await rest(f'resource_orders?resource_id=eq.{resource_id}&user_id=eq.{user["id"]}&status=eq.paid&select=*&limit=1')
        if not (resource.get('price_paise',1)==0 and resource.get('is_published')):
            if not orders:
                raise HTTPException(403,'Enrol in a Valuevade course or purchase this resource to download it.')
            await reconcile(orders[0],orders[0]['razorpay_payment_id'])
        fp = resource.get('file_path')
        if not fp:
            raise HTTPException(404,'The file for this resource has not been uploaded yet.')
        return await signed_download(fp)

    # ── Admin endpoints ───────────────────────────────────────────────────
    @router.get('/admin/resources')
    async def admin_list(user=Depends(get_user)):
        _ensure_admin(user)
        return await rest('marketplace_resources?select=*&order=created_at.desc&limit=500')

    @router.post('/admin/resources',status_code=201)
    async def create(body:Resource,user=Depends(get_user)):
        _ensure_admin(user)
        if body.is_published and body.price_paise > 0:
            raise HTTPException(400,'Save a draft and upload its file before publishing a paid resource.')
        return (await rest('marketplace_resources','POST',body.model_dump()))[0]

    @router.put('/admin/resources/{resource_id}')
    async def update(resource_id:UUID,body:Resource,user=Depends(get_user)):
        _ensure_admin(user)
        rows=await rest(f'marketplace_resources?id=eq.{resource_id}&select=file_path')
        if not rows:
            raise HTTPException(404,'Resource not found.')
        # Free (price_paise=0) resources can be published without a file;
        # enrolled users will receive an on-demand sample CSV.
        if body.is_published and body.price_paise > 0 and not rows[0].get('file_path'):
            raise HTTPException(400,'Upload the downloadable file before publishing a paid resource.')
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