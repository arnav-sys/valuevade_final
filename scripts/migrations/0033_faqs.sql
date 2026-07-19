-- 0033_faqs.sql — Persistent FAQ storage + seed of the 22 starter items.
-- Apply in Supabase Studio → SQL Editor. Idempotent (safe to re-run).

begin;

create extension if not exists "pgcrypto";

create table if not exists public.faqs (
    id            uuid primary key default gen_random_uuid(),
    category      text not null,
    question      text not null,
    answer        text not null,
    tags          text[] not null default '{}',
    order_index   integer not null default 100,
    is_published  boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists ix_faqs_category on public.faqs (category);
create index if not exists ix_faqs_order on public.faqs (order_index);
create unique index if not exists ux_faqs_question on public.faqs (lower(question));

alter table public.faqs enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
      where schemaname='public' and tablename='faqs'
  loop execute format('drop policy if exists %I on public.faqs', pol.policyname); end loop;
end$$;

-- Anyone (anon + authenticated) can read published FAQs. Writes are service-role only.
create policy "faqs_public_read"
  on public.faqs for select to anon, authenticated
  using (is_published);

grant select on public.faqs to anon, authenticated;
grant select, insert, update, delete on public.faqs to service_role;

-- Seed the 22 starter FAQs (idempotent on lowercase question).
insert into public.faqs (category, question, answer, tags, order_index) values
  ('Course','What is Valuevade?','Valuevade is an AI-personalised equity research and financial modelling programme for Indian finance students and career-switchers. It combines 22 modules, 246 sessions, 246 interactive simulations, and 3 capstone projects — with a 24/7 AI tutor, mock interviews, and a downloadable completion certificate.', array['what','about','platform','valuevade','introduction'], 10),
  ('Course','How long does the full course take?','Most students finish in 3–6 months at 1 hour a day. The Study Planner lets you pick a deadline or hours-per-day and it auto-schedules the sessions for you.', array['duration','time','how long','hours','weeks','months','schedule'], 20),
  ('Course','What topics do the modules cover?','You start from accounting and economics foundations, move through financial statement analysis, ratio analysis, forensic accounting, valuation (DCF, comps, SOTP), industry & competitive analysis, and finish with 3 capstones: a full initiating-coverage report, sector coverage, and an AI equity research copilot.', array['modules','topics','curriculum','syllabus','content'], 30),
  ('Course','Do I need prior finance knowledge?','No. Module 1 starts from zero — you learn what finance actually is, how the three financial statements work, and build up from there. Prior Excel or maths is helpful but not required.', array['prerequisites','beginner','zero','requirements','background','excel'], 40),
  ('Course','Does this replace CFA / FRM?','No — it complements them. Valuevade is skills- and workflow-focused: you build real 3-statement models, valuations, and a variant-perception thesis. CFA/FRM tests theory; Valuevade proves you can do the actual job.', array['cfa','frm','nism','certification','exam','replace'], 50),
  ('Pricing','How much does the course cost?','₹1,500 for lifetime access if you enrol upfront. Post-trial (after using the free session) it''s ₹1,700. One-time payment — no subscription, no hidden fees.', array['price','cost','fee','pricing','rupees','inr','how much','subscription'], 60),
  ('Pricing','Is there a free trial?','Yes. You can start with one full session (notes + quiz + interview + simulation) completely free before paying. No card required.', array['free','trial','demo','sample','try'], 70),
  ('Pricing','Do you offer refunds?','We offer refunds within 7 days of purchase if you''ve completed fewer than 3 sessions. Email support@valuevade.com with your account email and we''ll process it within 3 business days.', array['refund','money back','cancel','return','guarantee'], 80),
  ('Pricing','What payment methods are supported?','UPI, credit/debit cards, and net banking through Razorpay. International cards are supported for non-Indian students.', array['payment','razorpay','upi','card','debit','credit','net banking','international'], 90),
  ('Pricing','Is there an EMI option?','Given the ₹1,500 total, EMI isn''t cost-effective. Razorpay does support EMI for eligible cards, but the transaction fees typically exceed the savings.', array['emi','installment','monthly','plan'], 100),
  ('Certificate','Do I get a certificate on completion?','Yes — a downloadable PDF Certificate of Completion is issued the moment you finish all 3 capstone projects. It''s issued in your full name with the completion date and a unique certificate ID.', array['certificate','certification','diploma','proof','pdf'], 110),
  ('Certificate','Is the certificate recognised by employers?','The certificate demonstrates you''ve completed real analyst deliverables (a full initiating-coverage report, sector coverage, and an AI research copilot). It''s not a regulatory credential like CFA/NISM — but the capstone artifacts themselves are what recruiters review.', array['recognition','employer','recruiter','accreditation','validity'], 120),
  ('Certificate','Can I share the certificate on LinkedIn?','Yes — the PDF is designed for LinkedIn''s Add License/Certification field. We''re also planning a one-click LinkedIn share button in a future update.', array['linkedin','share','social','profile'], 130),
  ('Simulations','What kind of simulations do you have?','246 hands-on simulations across three formats: interactive Excel (formulas, drag-fill, VLOOKUP, multi-sheet — auto-graded), decision-making scenarios (branch-based case studies), and book-style read + quiz for concept-heavy topics. Every session has one.', array['simulation','excel','practice','hands-on','interactive','decision'], 140),
  ('Simulations','Who is Pari?','Pari is your AI tutor. Ask her any doubt during notes, quiz, interview, or simulation — she answers with context of the exact question you''re stuck on. Free users get 5 quick chats/day; paid users get extended 15-turn sessions and unlimited quick chats.', array['pari','tutor','ai','chat','doubt','assistant','help'], 150),
  ('Simulations','How do the mock interviews work?','3-round mock interview capstone unlocks after Module 14 (Valuation). An AI interviewer from a top Indian firm asks up to 6 questions per round, evaluates your voice or typed responses on technical/communication/structure, and gives round-by-round scores + feedback.', array['interview','mock','practice','voice','oral','analyst','hiring'], 160),
  ('Support','How do I contact support?','Email support@valuevade.com for account, payment, or refund issues. Content questions go through Pari (your AI tutor) — she''s faster and available 24/7.', array['contact','support','email','help','reach'], 170),
  ('Support','Does it work on mobile?','Yes — the notes, quiz, interviews, dashboard, and doubts chat work well on mobile. Excel simulations are best on laptop/desktop because of the grid interactions.', array['mobile','phone','android','ios','app','tablet','responsive'], 180),
  ('Support','Will I lose progress if I stop for a few weeks?','No. Your progress, streak, XP, badges, doubts history, and study plan are all persisted. You can pause any time and pick up exactly where you left off.', array['progress','pause','break','lose','save','streak','xp'], 190),
  ('Support','Can I change my email or delete my account?','Yes — email support@valuevade.com for account changes or deletion. GDPR/DPDP delete requests are honoured within 30 days.', array['account','delete','gdpr','dpdp','email change','privacy'], 200),
  ('Careers','Will Valuevade help me get a finance job?','The 3 capstones are designed as portfolio artefacts a recruiter can actually review: a full initiating-coverage report, a sector coverage note, and a working AI research copilot. Combined with the mock interview prep, they give you the exact deliverables junior analyst roles ask for.', array['job','career','placement','hire','recruiter','analyst','role'], 210),
  ('Careers','Can I share my learning progress publicly?','Yes. Every student gets a shareable Portfolio page (/p/your-slug) that shows XP, modules completed, capstones, and badges — no email exposed. Toggle it on from your Portfolio → Share.', array['portfolio','public','share','link','showcase','recruiter'], 220)
on conflict (lower(question)) do nothing;

commit;

select 'faqs_rows' as check, count(*) as value from public.faqs;
