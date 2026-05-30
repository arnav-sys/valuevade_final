// Node script: run the adapter against every master_simulations row in DB
// and report scoreable vs free-form vs failed counts.
// Requires the Babel/jsx transform we have in the project, so we use a
// minimal vanilla JS reimplementation of the adapter shape detector here.
// The actual UI uses the real adapter at runtime.

require('fs');
const path = require('path');
const envText = require('fs').readFileSync('/app/backend/.env', 'utf8');
const envLine = envText.split('\n').find((l) => l.startsWith('SUPABASE_SERVICE_ROLE_KEY'));
const KEY = envLine ? envLine.split('=')[1].trim() : '';
const https = require('https');

const SB_URL = 'https://yuadeybycbfqlkdpxbkv.supabase.co';

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function classify(sim) {
  const cfg = sim.config || {};
  // ---- Shape 2: legacy starter_grid + tasks ----
  if (cfg.starter_grid && Array.isArray(cfg.starter_grid.columns) && Array.isArray(cfg.tasks) && cfg.tasks.length > 0) {
    return { mode: 'auto', shape: 'legacy_starter_grid', sheets: 1 };
  }
  // ---- Shape 1: multi-tab workbook ----
  const raw = cfg.raw_data || cfg.data || null;
  if (raw && typeof raw === 'object') {
    const tabKeys = Object.keys(raw).filter((k) => /^Tab[_ ]?\d+/i.test(k));
    if (tabKeys.length > 0) return { mode: 'free_form', shape: 'multi_tab_workbook', sheets: tabKeys.length };
    // 1b: paired columns/rows convention
    const colKeys = Object.keys(raw).filter((k) => /columns?$/i.test(k));
    const pairs = colKeys.filter((ck) => {
      const prefix = ck.replace(/_?columns?$/i, '');
      const candidates = prefix === ''
        ? ['daily_rows','rows','data_rows','monthly_rows','quarterly_rows','yearly_rows']
        : [`${prefix}_rows`, `${prefix}_data`, prefix, `${prefix}_stocks`, `${prefix}_records`];
      return candidates.some((c) => Array.isArray(raw[c]) && raw[c].length > 0);
    });
    if (pairs.length > 0) return { mode: 'free_form', shape: 'paired_columns_rows', sheets: pairs.length };
    if (raw.Headers || raw.Rows || raw.headers || raw.rows) return { mode: 'free_form', shape: 'single_table', sheets: 1 };
    const keys = Object.keys(raw);
    if (keys.length > 0 && Array.isArray(raw[keys[0]])) return { mode: 'free_form', shape: 'by_column_object', sheets: 1 };
  }
  // ---- Shape 1e: top-level domain tables ----
  const SKIP = new Set([
    'firm','role','category','format','scoring','difficulty','total_tabs',
    'time_limit_minutes','concepts_tested','data_period','indian_market_context',
    'tab_names','instructions','brief','prompt','base_date','base_value',
    'index_name','bond_yield_pct','historical_avg_pe','excel_formulas_tested',
    'expected_solutions','raw_data','data',
  ]);
  const domainTables = Object.keys(cfg).filter((k) => {
    if (SKIP.has(k)) return false;
    const v = cfg[k];
    return Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && !Array.isArray(v[0]);
  });
  if (domainTables.length > 0) return { mode: 'free_form', shape: 'top_level_tables', sheets: Math.min(domainTables.length, 6) };
  if (Array.isArray(cfg.rows) && cfg.rows.length > 0) return { mode: 'free_form', shape: 'rows_array', sheets: 1 };
  return { mode: 'free_form', shape: 'empty_fallback', sheets: 0 };
}

(async () => {
  const sims = await get('master_simulations?sim_type=eq.excel&select=id,title,config&limit=500');
  console.log('Total excel sims:', sims.length);
  const buckets = { auto: 0, free_form: 0, failed: 0 };
  const byShape = {};
  const failed = [];
  for (const s of sims) {
    try {
      const r = classify(s);
      buckets[r.mode]++;
      byShape[r.shape] = (byShape[r.shape] || 0) + 1;
    } catch (e) {
      buckets.failed++;
      failed.push({ id: s.id, title: s.title, err: String(e) });
    }
  }
  console.log('\nMode breakdown:');
  console.log('  scoreable (auto):  ', buckets.auto);
  console.log('  free-form:         ', buckets.free_form);
  console.log('  failed:            ', buckets.failed);
  console.log('\nBy shape:');
  Object.entries(byShape).forEach(([k, v]) => console.log(`  ${k.padEnd(28)} ${v}`));
  if (failed.length) {
    console.log('\nFailed ids:');
    failed.forEach((f) => console.log(`  - ${f.id}  ${f.title}`));
  }
  // Spot-check 5 sims spanning M2-M13 by previewing their first sheet's structure.
  const probe = sims.slice(0, 5);
  console.log('\nSample preview of 5 sims:');
  probe.forEach((s) => {
    const r = classify(s);
    const raw = s.config?.raw_data;
    const tabs = raw ? Object.keys(raw).filter((k) => /^Tab[_ ]?\d+/i.test(k)) : [];
    console.log(`  ${s.id.slice(0,8)}  shape=${r.shape}  mode=${r.mode}  tabs=${tabs.length}  title=${(s.title||'').slice(0,50)}`);
  });
})().catch((e) => { console.error('ERR:', e); process.exit(1); });
