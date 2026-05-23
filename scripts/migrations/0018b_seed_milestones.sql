-- 0018b — Phase C seed: 15 module milestones + 9 count fallbacks.
--
-- Re-runnable via ON CONFLICT DO UPDATE. Module trigger_module_id values
-- are the live UUIDs from public.master_modules (resolved by title prefix
-- so the seed survives a UUID rotation as long as titles don't change).

begin;

-- ---------- MODULE MILESTONES (one per master_module) ----------
-- Title: <= 8 words.  Body: <= 25 words.  Icon: single emoji.
-- Tone: name a concrete capability the user gains by finishing the module.

insert into public.master_milestones
  (code, kind, trigger_module_id, trigger_count, title, body, icon, rarity, display_order)
select v.code, v.kind, m.id, null::int, v.title, v.body, v.icon, v.rarity, v.order_idx * 10
from (values
  ('m1_foundations',     'module', 1,
   'You speak the language of finance',
   'You can move money across time, read the three statements, and connect WACC, risk, and macro to real-world investing decisions.',
   '📐', 'epic'),
  ('m2_markets',         'module', 2,
   'You understand how Indian markets actually work',
   'From IPOs to T+1 settlement, SEBI rules to behavioural traps — you now see the full plumbing behind every Indian price tick.',
   '🏛️', 'epic'),
  ('m3_excel',           'module', 3,
   'Your Excel is desk-ready',
   'VLOOKUP, INDEX-MATCH, pivots, financial functions, sensitivity tables — your spreadsheets now look like an analyst built them.',
   '📊', 'epic'),
  ('m4_modelling',       'module', 4,
   'You can build a 3-statement model from scratch',
   'Income statement, balance sheet, cash flow — fully linked, driver-based, audit-clean. The single highest-leverage skill on the desk.',
   '🧮', 'legendary'),
  ('m5_governance',      'module', 5,
   'You can spot the next Satyam early',
   'Board structure, RPTs, promoter pledging, compensation games — you read the people behind the numbers and grade them like a pro.',
   '🛡️', 'epic'),
  ('m6_annual_reports',  'module', 6,
   'You can dissect a 300-page annual report in 2 minutes',
   'MD&A, auditor notes, RPTs, concall guidance — you extract the 15 insights that move the stock and ignore the rest.',
   '📑', 'epic'),
  ('m7_fsa',             'module', 7,
   'You can interrogate any company''s numbers',
   'Quality of earnings, DuPont ROE, working capital story, FCF reconciliation — you separate compounders from window-dressers fluently.',
   '🔍', 'epic'),
  ('m8_forensic',        'module', 8,
   'You can sniff out a blowup before it hits',
   'Channel stuffing, receivables stretch, M-Score, Z-Score, promoter pledging — you read footnotes like a detective hunting fraud.',
   '🚩', 'legendary'),
  ('m9_ratios',          'module', 9,
   'You can read any company''s soul through ratios',
   'DuPont, working capital cycle, sector-specific multiples, bank NIM and CASA — 30+ ratios turn into one defensible buy/hold/sell.',
   '📈', 'epic'),
  ('m10_macro',          'module', 10,
   'You can translate macro into target prices',
   'RBI policy, CPI surprises, INR moves, crude shocks, the Budget — you flip rate cuts into rupee changes on your target prices.',
   '🌐', 'epic'),
  ('m11_sectors',        'module', 11,
   'You can write a CLSA-grade sector note',
   'Banks, IT, FMCG, Auto, Pharma, Energy — you size up entire industries with Porter, cycles, and the metrics each one trades on.',
   '🏭', 'epic'),
  ('m12_valuation',      'module', 12,
   'You can value any business end-to-end',
   'DCF with FCFF/FCFE, WACC, comps, precedents, SOTP, sector-specific frameworks — every skill converges into one defensible target price.',
   '💎', 'legendary'),
  ('m13_reports',        'module', 13,
   'You can publish analyst-grade research',
   'Thesis, exhibits, valuation narrative, risk framing, deck design — your reports look like they came off a Mumbai sell-side desk.',
   '📝', 'epic'),
  ('m14_jobs',           'module', 14,
   'You are interview-ready for finance roles',
   'Analyst-grade resume, LinkedIn that pulls recruiters, 50-firm target list, cold outreach that converts — the playbook to break in.',
   '💼', 'epic'),
  ('m15_ai',             'module', 15,
   'You are an AI-augmented equity analyst',
   'R-T-C-O-F-E prompting, chain-of-thought, hallucination guardrails, SEBI compliance — you 10x your research output without faking it.',
   '🤖', 'legendary')
) as v(code, kind, order_idx, title, body, icon, rarity)
join public.master_modules m on m.order_index = v.order_idx
on conflict (code) do update set
  trigger_module_id = excluded.trigger_module_id,
  trigger_count     = excluded.trigger_count,
  title             = excluded.title,
  body              = excluded.body,
  icon              = excluded.icon,
  rarity            = excluded.rarity,
  display_order     = excluded.display_order;


-- ---------- COUNT MILESTONES (fallback) ----------
insert into public.master_milestones
  (code, kind, trigger_module_id, trigger_count, title, body, icon, rarity, display_order)
values
  ('count_3',   'count', null, 3,
   'First Steps',
   'Three sessions deep — momentum is starting to feel real. Most people never get past one.',
   '🌱', 'common', 1003),
  ('count_7',   'count', null, 7,
   'Finding Your Rhythm',
   'A week''s worth of work done. The shape of an analyst''s brain is beginning to form.',
   '🎯', 'common', 1007),
  ('count_12',  'count', null, 12,
   'Building Momentum',
   'A dozen sessions in — the concepts are starting to network and connect on their own.',
   '🔥', 'rare', 1012),
  ('count_18',  'count', null, 18,
   'Hooked',
   'Eighteen down. You''re not "taking a course" anymore — you''re training for a job.',
   '⚡', 'rare', 1018),
  ('count_25',  'count', null, 25,
   'Quarter Century',
   '25 sessions completed. You''re in the top 10% of anyone who has ever started this thing.',
   '🥉', 'epic', 1025),
  ('count_35',  'count', null, 35,
   'Serious Operator',
   '35 sessions deep — at this point, recruiters at your target firms should be hearing your name.',
   '🥈', 'epic', 1035),
  ('count_50',  'count', null, 50,
   'Half Century',
   'Fifty sessions. You''re past the halfway point. Most equity research bootcamps don''t even cover this much.',
   '🏅', 'epic', 1050),
  ('count_75',  'count', null, 75,
   'Three-Quarter Mark',
   '75 sessions. You can hold your own in any analyst interview right now — but you''re not stopping here.',
   '🥇', 'legendary', 1075),
  ('count_100', 'count', null, 100,
   'Hundred Sessions Strong',
   '100 sessions done. Genuinely few in Indian finance can match the depth you''ve built. The desk is waiting.',
   '🏆', 'legendary', 1100)
on conflict (code) do update set
  trigger_count = excluded.trigger_count,
  title         = excluded.title,
  body          = excluded.body,
  icon          = excluded.icon,
  rarity        = excluded.rarity,
  display_order = excluded.display_order;

commit;
