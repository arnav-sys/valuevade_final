/**
 * Static FAQ knowledge base — used as offline fallback for the landing
 * accordion + help chatbot. The primary source is the Supabase `faqs`
 * table via GET /api/faqs (admins CRUD from the Admin panel). This
 * static copy stays in sync with the homepage FAQ set defined by Prompt-2
 * of the Aug-2026 SEO/GEO rebuild.
 */
export const FAQ_CATEGORIES = ['Course', 'Pricing', 'Certificate', 'Simulations', 'Support'];

export const FAQS = [
  {
    id: 'course-what-is-valuevade',
    category: 'Course',
    question: 'What is Valuevade?',
    answer: "Valuevade is an AI-personalised equity research and financial modelling course for Indian finance students and early-career switchers. The Equity Research Analyst Program includes 21 modules, 239 hands-on sessions and 3 capstone projects, with a personalised AI roadmap, a 24/7 AI tutor (Pari), AI mock interviews, NISM Series XV certification preparation, and a downloadable Certificate of Completion. It's fully self-paced online, built on Indian companies and Ind AS conventions, and costs ₹999 one-time for lifetime access.",
    tags: ['what', 'about', 'platform', 'valuevade', 'introduction'],
  },
  {
    id: 'pricing-cost',
    category: 'Pricing',
    question: 'How much does the Valuevade course cost?',
    answer: "The Equity Research Analyst Program costs ₹999 as a one-time payment for lifetime access. That includes all 21 modules, 239 sessions and simulations, the three capstone projects, Pari (the 24/7 AI tutor), AI mock interviews, NISM Series XV certification prep, and your Certificate of Completion. There is no subscription, no post-trial price change, and no extra charge for the certificate. You can try your first full session — notes, quiz, interview and simulation — free before paying, with no card required.",
    tags: ['price', 'cost', 'fee', 'pricing', 'rupees', 'inr', 'how much', 'subscription'],
  },
  {
    id: 'course-prerequisites',
    category: 'Course',
    question: 'Do I need prior finance knowledge?',
    answer: "No. Module 1 starts from zero — what finance actually is, how the three financial statements work — and builds up from there. Basic Excel and maths help but aren't required, and Pari can explain any prerequisite concept the moment you're stuck on it. The program is designed for B.Com, BBA and other students taking a financial modelling course for beginners as their first serious step.",
    tags: ['prerequisites', 'beginner', 'zero', 'requirements', 'background', 'excel'],
  },
  {
    id: 'pricing-vs-competitors',
    category: 'Pricing',
    question: 'How is Valuevade so much cheaper than other equity research courses in India?',
    answer: "Because it's software, not batches. Traditional programs price in live faculty hours, physical classrooms and sales teams — typically ₹25,000 to ₹1,20,000. Valuevade delivers the same skill set through recorded expert lectures, auto-graded simulations and an AI tutor, built by a solo founder with no campus and no sales floor. Lower cost structure, lower price — ₹999 lifetime. The free first session exists so you can judge the quality before paying anything.",
    tags: ['cheap', 'price comparison', 'affordable', 'why cheap', 'cost'],
  },
  {
    id: 'cert-what',
    category: 'Certificate',
    question: 'What certificate do I get?',
    answer: "You receive Valuevade's Certificate of Completion — a PDF issued in your full name with the completion date and a unique certificate ID, generated the moment you finish all three capstone projects. It's formatted for LinkedIn's Licenses & Certifications section. The curriculum also prepares you for the NISM Series XV (Research Analyst) exam — a SEBI-established certification; you sit that exam with the issuing body, and Valuevade's course maps to its content rather than issuing its certificate.",
    tags: ['certificate', 'certification', 'nism', 'linkedin', 'proof'],
  },
  {
    id: 'support-mobile',
    category: 'Support',
    question: 'Does Valuevade work on mobile?',
    answer: "Mostly, yes. Notes, quizzes, mock interviews, your dashboard and Pari all work well on mobile. The Excel simulations are desktop/laptop-only by design — spreadsheet grid work doesn't translate to a phone screen — so plan your hands-on sessions for a computer.",
    tags: ['mobile', 'phone', 'android', 'ios', 'tablet', 'responsive', 'excel'],
  },
  {
    id: 'sim-pari',
    category: 'Simulations',
    question: 'Who is Pari?',
    answer: "Pari is Valuevade's AI tutor, available 24/7. Ask her a doubt during any note, quiz, interview or simulation and she answers with the context of the exact item you're stuck on. Free users get 5 quick chats a day; paid users get unlimited quick chats plus extended 15-turn sessions.",
    tags: ['pari', 'tutor', 'ai', 'chat', 'doubt', 'assistant', 'help'],
  },
  {
    id: 'course-instructor',
    category: 'Course',
    question: 'Who teaches the course?',
    answer: "The 42 hours of video lectures are designed and taught by Saarthak Bhatia — a qualified Chartered Accountant (CA), CMA US and ACCA (UK), with close to five years of teaching experience at Grant Thornton Bharat, FinTram Global, Zell Education and QuintEdge (and earlier at The Narayana Group and Byju's Learning App). He built the full course content end-to-end. You can read more in the 'Who built this' section above.",
    tags: ['teacher', 'instructor', 'who', 'saarthak', 'ca', 'cma', 'acca', 'founder'],
  },
  // Preserved verbatim from the previous set
  {
    id: 'pricing-payment-methods',
    category: 'Pricing',
    question: 'What payment methods are supported?',
    answer: "UPI, credit/debit cards, and net banking through Razorpay. International cards are supported for non-Indian students.",
    tags: ['payment', 'razorpay', 'upi', 'card', 'debit', 'credit', 'net banking', 'international'],
  },
  {
    id: 'support-contact',
    category: 'Support',
    question: 'How do I contact support?',
    answer: "Email support@valuevade.com for account, payment, or refund issues. Content questions go through Pari (your AI tutor) — she's faster and available 24/7.",
    tags: ['contact', 'support', 'email', 'help', 'reach'],
  },
  {
    id: 'support-account',
    category: 'Support',
    question: 'Can I change my email or delete my account?',
    answer: "Yes — email support@valuevade.com for account changes or deletion. GDPR/DPDP delete requests are honoured within 30 days.",
    tags: ['account', 'delete', 'gdpr', 'dpdp', 'email change', 'privacy'],
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
 */
export function scoreFaq(faq, query) {
  const q = normaliseText(query);
  if (!q) return 0;
  const words = q.split(' ').filter((w) => w.length > 1);
  if (!words.length) return 0;

  const questionText = normaliseText(faq.question);
  const answerText = normaliseText(faq.answer);
  const tagsText = normaliseText((faq.tags || []).join(' '));

  let score = 0;
  for (const w of words) {
    if (new RegExp(`\\b${w}\\b`).test(questionText)) score += 6;
    else if (questionText.includes(w)) score += 3;

    if (new RegExp(`\\b${w}\\b`).test(tagsText)) score += 4;
    else if (tagsText.includes(w)) score += 2;

    if (new RegExp(`\\b${w}\\b`).test(answerText)) score += 2;
    else if (answerText.includes(w)) score += 1;
  }
  if (questionText.includes(q)) score += 8;
  return score;
}

export function searchFaqs(query, limit = 5) {
  return FAQS
    .map((f) => ({ faq: f, score: scoreFaq(f, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.faq);
}
