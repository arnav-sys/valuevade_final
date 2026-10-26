"""
Seed 7 sample resources that map to every resource type promised on the
Valuevade course details page.  Each resource uses price_paise=0 so enrolled
students can download the on-the-fly sample CSV immediately.

Usage (from /app/backend):
    python /app/scripts/seed_resources.py

Requires REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env.
"""
import os, sys, json, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)) + '/backend')

SUPABASE_URL = os.environ.get('REACT_APP_SUPABASE_URL', '').rstrip('/')
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SERVICE_KEY:
    sys.exit('❌  Set REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.')

HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation,resolution=ignore-duplicates',
}

RESOURCES = [
    {
        'title': 'HR Database Template — Finance Sector',
        'description': (
            'A structured HR database built for finance teams. Covers employee records, '
            'compensation bands, performance ratings, and headcount planning. '
            'Includes five editable sheets: Headcount, Comp Bands, Org Chart, '
            'Attrition Tracker, and Hiring Pipeline. Pre-filled with sample data across '
            'Equity Research, IB, Corporate Finance, and Risk verticals.'
        ),
        'category': 'Sector study frameworks',
        'price_paise': 0,
        'is_published': True,
        'includes': [
            'Headcount tracker by team, seniority, and location',
            'Compensation bands benchmarked against Indian finance market',
            'Attrition and hiring pipeline dashboard',
            'Org-chart template (flat and hierarchical)',
            'Editable CSV format — import into HR tools directly',
        ],
    },
    {
        'title': 'Financial Modelling Templates — Core Bundle',
        'description': (
            'Three ready-to-use financial modelling templates tailored for Indian markets: '
            'DCF valuation, LBO model, and a Comps trading comparables sheet. '
            'Each template ships with hard-coded sample company data '
            '(FMCG, Pharma, Infrastructure) and step-by-step formula notes. '
            'Perfect for interview prep and on-the-job client work.'
        ),
        'category': 'Excel financial models',
        'price_paise': 0,
        'is_published': True,
        'includes': [
            'DCF model: 3-statement link, WACC build, sensitivity table',
            'LBO model: debt schedule, returns waterfall, sponsor returns',
            'Trading comps: 15 pre-filled companies across 3 sectors',
            'Formula guide tab with explanation of every driver',
            'India-specific tax and depreciation assumptions pre-configured',
        ],
    },
    {
        'title': 'Equity Research Report Template',
        'description': (
            'A publication-ready equity research report template structured around the '
            'CFA / SEBI analyst report format. Covers company overview, '
            'investment thesis, financial model summary, peer comparison, '
            'risk factors, and 12-month price target build. '
            'Includes a 10-page written template and a supporting Excel model.'
        ),
        'category': 'Equity research report templates',
        'price_paise': 0,
        'is_published': True,
        'includes': [
            'Structured 10-section report outline (Word + PDF format)',
            'Financial summary table (Income Statement, Balance Sheet, Cash Flow)',
            'Peer comparison matrix with 8 pre-filled companies',
            'Price target methodology: DCF + EV/EBITDA blended',
            'Analyst disclosures, ratings definitions, and legal boilerplate',
        ],
    },
    {
        'title': 'AI Agent Workflows for Finance Professionals',
        'description': (
            'Step-by-step AI agent workflow guides for five high-value finance use cases: '
            'financial modelling co-pilot, earnings call summariser, '
            'sector screener builder, credit memo drafter, and pitch book assembler. '
            'Each workflow maps the input → prompt chain → output with '
            'tool recommendations (ChatGPT, Claude, Perplexity, Sheets AI).'
        ),
        'category': 'AI prompt packs',
        'price_paise': 0,
        'is_published': True,
        'includes': [
            '5 end-to-end AI workflow templates with annotated steps',
            'Prompt library: 40+ tested prompts across each workflow',
            'Tool stack recommendation (free and paid options)',
            'Sample outputs: real AI-generated outputs with critique',
            'Weekly workflow update newsletter (6-month access)',
        ],
    },
    {
        'title': 'Prompts Library — Finance Edition (200+ Prompts)',
        'description': (
            '200+ battle-tested prompts organised by finance sub-discipline: '
            'valuation, credit analysis, portfolio management, '
            'M&A due diligence, and financial communications. '
            'Each prompt includes context, example output, and a remix guide '
            'so you can adapt it to your exact use case instantly.'
        ),
        'category': 'AI prompt packs',
        'price_paise': 0,
        'is_published': True,
        'includes': [
            '200+ prompts covering 12 finance sub-disciplines',
            'Prompt engineering cheat sheet (roles, tone, output format)',
            'Excel: filterable prompt database with tags',
            'Sample outputs for each prompt category',
            'Quarterly prompt update pack (for 12 months)',
        ],
    },
    {
        'title': 'Finance Project Templates — Client Deliverables Pack',
        'description': (
            'Six client-facing finance project templates used in consulting, '
            'IB, and corporate finance: strategic plan summary, '
            'board presentation deck structure, financial review memo, '
            'market entry assessment, M&A teaser template, and '
            'quarterly management pack. Built to PowerPoint and Excel standards.'
        ),
        'category': 'Excel financial models',
        'price_paise': 0,
        'is_published': True,
        'includes': [
            'Strategic plan summary (slide deck and Word outline)',
            'Board-ready financial review memo (8 sections)',
            'M&A teaser template with anonymised sample',
            'Quarterly management pack (5 KPI dashboards)',
            'Professional formatting guide: fonts, colours, white space rules',
        ],
    },
    {
        'title': 'Finance Interview Prep — Questions, Frameworks & Answers',
        'description': (
            'A comprehensive interview prep kit for finance roles: '
            'IB analyst, equity research associate, corporate finance, '
            'and Big 4 transaction advisory. '
            'Covers 120 technical questions (accounting, valuation, M&A, '
            'LBO), 30 behavioural questions, and 10 stock pitch frameworks '
            'with model answers and self-evaluation rubrics.'
        ),
        'category': 'Interview prep kits',
        'price_paise': 0,
        'is_published': True,
        'includes': [
            '120 technical questions with structured model answers',
            '30 behavioural questions (STAR method answers included)',
            '10 stock pitch frameworks across different sectors',
            'Day-by-day 4-week prep schedule',
            'Mock interview self-evaluation scorecard',
        ],
    },
]


def upsert(payload: dict):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/marketplace_resources',
        data=data, headers=HEADERS, method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


if __name__ == '__main__':
    print(f'Seeding {len(RESOURCES)} resources to {SUPABASE_URL} …\n')
    for i, r in enumerate(RESOURCES, 1):
        try:
            result = upsert(r)
            rid = result[0].get('id') if isinstance(result, list) else '?'
            print(f'  [{i}/{len(RESOURCES)}] ✓  {r["title"][:60]}  (id={rid})')
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f'  [{i}/{len(RESOURCES)}] ✗  {r["title"][:60]} — HTTP {e.code}: {body[:120]}')
        except Exception as exc:
            print(f'  [{i}/{len(RESOURCES)}] ✗  {r["title"][:60]} — {exc}')
    print('\nDone.')
