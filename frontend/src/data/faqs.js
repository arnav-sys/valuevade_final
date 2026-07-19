/**
 * Static FAQ knowledge base — used as offline fallback for the landing
 * accordion + help chatbot. The primary source is now the Supabase `faqs`
 * table via GET /api/faqs (admins can CRUD from the Admin panel). This
 * static copy stays in sync with 0033_faqs.sql so the UI still works if
 * the backend is unreachable.
 */
export const FAQ_CATEGORIES = ['Course', 'Pricing', 'Certificate', 'Simulations', 'Support', 'Careers'];

export const FAQS = [
  // ─── COURSE STRUCTURE ─────────────────────────────────────────────────
  {
    id: 'course-what-is-valuevade',
    category: 'Course',
    question: 'What is Valuevade?',
    answer: "Valuevade is an AI-personalised equity research and financial modelling programme for Indian finance students and career-switchers. It combines 22 modules, 246 sessions, 246 interactive simulations, and 3 capstone projects — with a 24/7 AI tutor, mock interviews, and a downloadable completion certificate.",
    tags: ['what', 'about', 'platform', 'valuevade', 'introduction'],
  },
  {
    id: 'course-duration',
    category: 'Course',
    question: 'How long does the full course take?',
    answer: "Most students finish in 3–6 months at 1 hour a day. The Study Planner lets you pick a deadline or hours-per-day and it auto-schedules the sessions for you.",
    tags: ['duration', 'time', 'how long', 'hours', 'weeks', 'months', 'schedule'],
  },
  {
    id: 'course-modules',
    category: 'Course',
    question: 'What topics do the modules cover?',
    answer: "You start from accounting and economics foundations, move through financial statement analysis, ratio analysis, forensic accounting, valuation (DCF, comps, SOTP), industry & competitive analysis, and finish with 3 capstones: a full initiating-coverage report, sector coverage, and an AI equity research copilot.",
    tags: ['modules', 'topics', 'curriculum', 'syllabus', 'content', 'what will i learn'],
  },
  {
    id: 'course-prerequisites',
    category: 'Course',
    question: 'Do I need prior finance knowledge?',
    answer: "No. Module 1 starts from zero — you learn what finance actually is, how the three financial statements work, and build up from there. Prior Excel or maths is helpful but not required.",
    tags: ['prerequisites', 'beginner', 'zero', 'requirements', 'background', 'excel'],
  },
  {
    id: 'course-cfa-frm',
    category: 'Course',
    question: 'Does this replace CFA / FRM?',
    answer: "No — it complements them. Valuevade is skills- and workflow-focused: you build real 3-statement models, valuations, and a variant-perception thesis. CFA/FRM tests theory; Valuevade proves you can do the actual job.",
    tags: ['cfa', 'frm', 'nism', 'certification', 'exam', 'replace'],
  },

  // ─── PRICING & PAYMENT ────────────────────────────────────────────────
  {
    id: 'pricing-cost',
    category: 'Pricing',
    question: 'How much does the course cost?',
    answer: "₹1,500 for lifetime access if you enrol upfront. Post-trial (after using the free session) it's ₹1,700. One-time payment — no subscription, no hidden fees.",
    tags: ['price', 'cost', 'fee', 'pricing', 'rupees', 'inr', 'how much', 'subscription'],
  },
  {
    id: 'pricing-free-trial',
    category: 'Pricing',
    question: 'Is there a free trial?',
    answer: "Yes. You can start with one full session (notes + quiz + interview + simulation) completely free before paying. No card required.",
    tags: ['free', 'trial', 'demo', 'sample', 'try'],
  },
  {
    id: 'pricing-refund',
    category: 'Pricing',
    question: 'Do you offer refunds?',
    answer: "We offer refunds within 7 days of purchase if you've completed fewer than 3 sessions. Email support@valuevade.com with your account email and we'll process it within 3 business days.",
    tags: ['refund', 'money back', 'cancel', 'return', 'guarantee'],
  },
  {
    id: 'pricing-payment-methods',
    category: 'Pricing',
    question: 'What payment methods are supported?',
    answer: "UPI, credit/debit cards, and net banking through Razorpay. International cards are supported for non-Indian students.",
    tags: ['payment', 'razorpay', 'upi', 'card', 'debit', 'credit', 'net banking', 'international'],
  },
  {
    id: 'pricing-emi',
    category: 'Pricing',
    question: 'Is there an EMI option?',
    answer: "Given the ₹1,500 total, EMI isn't cost-effective. Razorpay does support EMI for eligible cards, but the transaction fees typically exceed the savings.",
    tags: ['emi', 'installment', 'monthly', 'plan'],
  },

  // ─── CERTIFICATE ──────────────────────────────────────────────────────
  {
    id: 'cert-what',
    category: 'Certificate',
    question: 'Do I get a certificate on completion?',
    answer: "Yes — a downloadable PDF Certificate of Completion is issued the moment you finish all 3 capstone projects. It's issued in your full name with the completion date and a unique certificate ID.",
    tags: ['certificate', 'certification', 'diploma', 'proof', 'pdf'],
  },
  {
    id: 'cert-recognized',
    category: 'Certificate',
    question: 'Is the certificate recognised by employers?',
    answer: "The certificate demonstrates you've completed real analyst deliverables (a full initiating-coverage report, sector coverage, and an AI research copilot). It's not a regulatory credential like CFA/NISM — but the capstone artifacts themselves are what recruiters review.",
    tags: ['recognition', 'employer', 'recruiter', 'accreditation', 'validity'],
  },
  {
    id: 'cert-linkedin',
    category: 'Certificate',
    question: 'Can I share the certificate on LinkedIn?',
    answer: "Yes — the PDF is designed for LinkedIn's Add License/Certification field. We're also planning a one-click LinkedIn share button in a future update.",
    tags: ['linkedin', 'share', 'social', 'profile'],
  },

  // ─── SIMULATIONS & TOOLS ──────────────────────────────────────────────
  {
    id: 'sim-what',
    category: 'Simulations',
    question: 'What kind of simulations do you have?',
    answer: "246 hands-on simulations across three formats: interactive Excel (formulas, drag-fill, VLOOKUP, multi-sheet — auto-graded), decision-making scenarios (branch-based case studies), and book-style read + quiz for concept-heavy topics. Every session has one.",
    tags: ['simulation', 'excel', 'practice', 'hands-on', 'interactive', 'decision'],
  },
  {
    id: 'sim-pari',
    category: 'Simulations',
    question: 'Who is Pari?',
    answer: "Pari is your AI tutor. Ask her any doubt during notes, quiz, interview, or simulation — she answers with context of the exact question you're stuck on. Free users get 5 quick chats/day; paid users get extended 15-turn sessions and unlimited quick chats.",
    tags: ['pari', 'tutor', 'ai', 'chat', 'doubt', 'assistant', 'help'],
  },
  {
    id: 'sim-mock-interview',
    category: 'Simulations',
    question: 'How do the mock interviews work?',
    answer: "3-round mock interview capstone unlocks after Module 14 (Valuation). An AI interviewer from a top Indian firm asks up to 6 questions per round, evaluates your voice or typed responses on technical/communication/structure, and gives round-by-round scores + feedback.",
    tags: ['interview', 'mock', 'practice', 'voice', 'oral', 'analyst', 'hiring'],
  },

  // ─── SUPPORT & TECHNICAL ──────────────────────────────────────────────
  {
    id: 'support-contact',
    category: 'Support',
    question: 'How do I contact support?',
    answer: "Email support@valuevade.com for account, payment, or refund issues. Content questions go through Pari (your AI tutor) — she's faster and available 24/7.",
    tags: ['contact', 'support', 'email', 'help', 'reach'],
  },
  {
    id: 'support-mobile',
    category: 'Support',
    question: 'Does it work on mobile?',
    answer: "Yes — the notes, quiz, interviews, dashboard, and doubts chat work well on mobile. Excel simulations are best on laptop/desktop because of the grid interactions.",
    tags: ['mobile', 'phone', 'android', 'ios', 'app', 'tablet', 'responsive'],
  },
  {
    id: 'support-progress',
    category: 'Support',
    question: 'Will I lose progress if I stop for a few weeks?',
    answer: "No. Your progress, streak, XP, badges, doubts history, and study plan are all persisted. You can pause any time and pick up exactly where you left off.",
    tags: ['progress', 'pause', 'break', 'lose', 'save', 'streak', 'xp'],
  },
  {
    id: 'support-account',
    category: 'Support',
    question: 'Can I change my email or delete my account?',
    answer: "Yes — email support@valuevade.com for account changes or deletion. GDPR/DPDP delete requests are honoured within 30 days.",
    tags: ['account', 'delete', 'gdpr', 'dpdp', 'email change', 'privacy'],
  },

  // ─── CAREERS ──────────────────────────────────────────────────────────
  {
    id: 'careers-job',
    category: 'Careers',
    question: 'Will Valuevade help me get a finance job?',
    answer: "The 3 capstones are designed as portfolio artefacts a recruiter can actually review: a full initiating-coverage report, a sector coverage note, and a working AI research copilot. Combined with the mock interview prep, they give you the exact deliverables junior analyst roles ask for.",
    tags: ['job', 'career', 'placement', 'hire', 'recruiter', 'analyst', 'role'],
  },
  {
    id: 'careers-portfolio',
    category: 'Careers',
    question: 'Can I share my learning progress publicly?',
    answer: "Yes. Every student gets a shareable Portfolio page (`/p/your-slug`) that shows XP, modules completed, capstones, and badges — no email exposed. Toggle it on from your Portfolio → Share.",
    tags: ['portfolio', 'public', 'share', 'link', 'showcase', 'recruiter'],
  },
];

/**
 * Normalise text for keyword matching — lowercase, strip punctuation.
 */
export function normaliseText(s) {
  return (s || '').toString().toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Score an FAQ against a user's query. Returns 0..∞.
 * - Every full-word match in the question adds a lot
 * - Full-word matches in tags/answer add less
 * - Substring matches on question add a little
 * - Zero if no words overlap
 */
export function scoreFaq(faq, query) {
  const q = normaliseText(query);
  if (!q) return 0;
  const words = q.split(' ').filter(w => w.length > 1);
  if (!words.length) return 0;

  const questionText = normaliseText(faq.question);
  const answerText = normaliseText(faq.answer);
  const tagsText = normaliseText((faq.tags || []).join(' '));

  let score = 0;
  for (const w of words) {
    // Exact word match — biggest signal
    if (new RegExp(`\\b${w}\\b`).test(questionText)) score += 6;
    else if (questionText.includes(w)) score += 3;

    if (new RegExp(`\\b${w}\\b`).test(tagsText)) score += 4;
    else if (tagsText.includes(w)) score += 2;

    if (new RegExp(`\\b${w}\\b`).test(answerText)) score += 2;
    else if (answerText.includes(w)) score += 1;
  }
  // Bonus if the FULL query appears as a substring of the question
  if (questionText.includes(q)) score += 8;
  return score;
}

/**
 * Return top-N FAQ matches for a query, sorted by score descending.
 * Excludes zero-scoring entries.
 */
export function searchFaqs(query, limit = 5) {
  return FAQS
    .map(f => ({ faq: f, score: scoreFaq(f, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.faq);
}
