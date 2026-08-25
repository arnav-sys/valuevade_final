"""One-off migration to normalize ALL-CAPS master_modules titles to Title Case.
Safe to re-run: only updates rows whose current title exactly matches the old value.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

url = os.environ.get('REACT_APP_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

# Map of module_number -> (old_title, new_title)
UPDATES = {
    3: ('EXCEL FUNDAMENTALS FOR ANALYSTS', 'Excel Fundamentals for Analysts'),
    7: ('FINANCIAL STATEMENT ANALYSIS', 'Financial Statement Analysis'),
    8: ('RED FLAG ANALYSIS & FORENSIC ACCOUNTING', 'Red Flag Analysis & Forensic Accounting'),
    9: ('ADVANCED RATIO ANALYSIS', 'Advanced Ratio Analysis'),
    10: ('ECONOMY & MACRO ANALYSIS FOR EQUITY RESEARCH', 'Economy & Macro Analysis for Equity Research'),
    11: ('SECTOR ANALYSIS — EVERY MAJOR INDIAN SECTOR', 'Sector Analysis — Every Major Indian Sector'),
    20: ('EQUITY RESEARCH INTERVIEW MASTERY', 'Equity Research Interview Mastery'),
}


def main():
    for module_number, (old_title, new_title) in UPDATES.items():
        # PATCH only if title still matches the old ALL-CAPS value.
        r = requests.patch(
            f'{url}/rest/v1/master_modules'
            f'?module_number=eq.{module_number}'
            f'&title=eq.{requests.utils.quote(old_title)}',
            headers=headers,
            json={'title': new_title},
        )
        if r.status_code >= 400:
            print(f'M{module_number}: ERROR {r.status_code} {r.text}')
            continue
        rows = r.json()
        if rows:
            print(f'M{module_number}: updated -> {new_title!r}')
        else:
            print(f'M{module_number}: no-op (already normalized or missing)')


if __name__ == '__main__':
    main()
