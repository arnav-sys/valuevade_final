import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FreeTrialCTA from '@/components/FreeTrialCTA';
import { CheckCircle2, Clock, FileSpreadsheet, Mic, Trophy, Users, ArrowRight, Sparkles } from 'lucide-react';

/**
 * FreeMockInterviewPage — dedicated public marketing page for the one-time
 * free equity-research mock interview trial. Reached from the Navbar link
 * ("Free Mock") and via direct URL /free-mock-interview.
 * ------------------------------------------------------------------
 * Reuses the existing `FreeTrialCTA` section (which owns the email-capture
 * form, backend guard call, and post-submit redirect into `/free-trial/{id}`).
 * The page wraps that section with:
 *   - a proper H1 hero for SEO
 *   - "What happens next" 5-round walkthrough
 *   - trust strip
 *   - full Navbar + Footer chrome (unlike the guest player, which is chromeless)
 */

const ROUNDS = [
  { n: 1, title: 'Application', body: "Answer three recruiter-style prompts. Pari grades your fit note and shortlists you for the online assessment.", icon: Users },
  { n: 2, title: 'Aptitude', body: "12 auto-graded quant + reasoning questions on a 15-minute clock. The same style Indian brokerages use for first-round screening.", icon: FileSpreadsheet },
  { n: 3, title: 'HR round', body: "Voice-first behavioural interview. Pari speaks in the Nova voice; you answer aloud or by typing. Structured, probing, realistic.", icon: Mic },
  { n: 4, title: 'Technical', body: "Five equity-research questions — DCF, comps, ratios, macro. Follow-ups and pushback built in, exactly like a real analyst interview.", icon: Sparkles },
  { n: 5, title: 'Case study', body: "A live Excel case in your browser. Build the required cells, then defend your recommendation in writing. Fully auto-graded.", icon: Trophy },
];

export default function FreeMockInterviewPage() {
  const [landingTheme, setLandingTheme] = useState('dark');
  const toggleLandingTheme = () =>
    setLandingTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <div
      className={`min-h-screen bg-[var(--bg-primary)] text-[var(--color-text)] ${landingTheme === 'light' ? 'landing-light' : ''}`}
      data-testid="free-mock-page"
    >
      <Helmet>
        <title>Free Equity Research Mock Interview — 5 Rounds, AI-Graded | Valuevade</title>
        <meta name="description" content="Free 5-round equity research mock interview: application, aptitude, HR, technical, and a live Excel case study. AI-graded verdict + scorecard. No signup, no card." />
        <link rel="canonical" href="https://valuevade.com/free-mock-interview" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://valuevade.com/free-mock-interview" />
        <meta property="og:title" content="Free Equity Research Mock Interview — 5 Rounds, AI-Graded | Valuevade" />
        <meta property="og:description" content="Free 5-round equity research mock interview by Pari, our AI interviewer. Scorecard + verdict. No signup, no card." />
        <meta property="og:image" content="https://valuevade.com/valuevade-logo.png" />
        <meta property="og:site_name" content="Valuevade" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Free Equity Research Mock Interview — 5 Rounds, AI-Graded" />
        <meta name="twitter:description" content="Free 5-round equity research mock interview by Pari. Scorecard + verdict. No signup, no card." />
        <meta name="twitter:image" content="https://valuevade.com/valuevade-logo.png" />
      </Helmet>

      <Navbar landingTheme={landingTheme} onToggleLandingTheme={toggleLandingTheme} />

      <main className="relative z-10">
        {/* Hero */}
        <section
          className="relative pt-32 pb-14 sm:pt-40 sm:pb-20 overflow-hidden"
          data-testid="free-mock-hero"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[var(--color-accent-purple)] opacity-[0.10] blur-[140px]" />
          <div className="max-w-4xl mx-auto px-6 text-center relative">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/25 text-[var(--color-accent-purple)] text-[10px] font-mono uppercase tracking-[0.2em] mb-6"
              data-testid="free-mock-eyebrow"
            >
              <Sparkles size={11} /> Free · One-time · No signup
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="font-clash text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text)] leading-tight"
              data-testid="free-mock-h1"
            >
              Try a full analyst mock interview. <span className="text-[var(--color-primary)]">Free.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mt-5 text-base sm:text-lg text-[var(--color-text-muted)] font-bricolage leading-relaxed max-w-2xl mx-auto"
              data-testid="free-mock-lead"
            >
              Five rounds — application, aptitude, HR, technical, and a live Excel case study — run
              by Pari as a bulge-bracket-style interviewer. You get a full scorecard and verdict at
              the end. One free trial per person. No card required.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-5 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--color-text-faint)]"
              data-testid="free-mock-trust"
            >
              30-45 min · Voice + Excel · Instant AI scorecard
            </motion.p>
          </div>
        </section>

        {/* 5-round walkthrough */}
        <section className="pb-14 sm:pb-16" data-testid="free-mock-rounds-section">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-3 text-center">
              What happens in the trial
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] font-bricolage text-center max-w-2xl mx-auto mb-10">
              Every round mirrors what an Indian brokerage or bulge-bracket firm would actually put
              you through. Nothing simulated, nothing softened.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ROUNDS.map((r, i) => {
                const Icon = r.icon;
                return (
                  <motion.div
                    key={r.n}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="glass-card rounded-2xl p-5"
                    data-testid={`free-mock-round-${r.n}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 flex items-center justify-center text-xs font-mono text-[var(--color-primary)]">
                        R{r.n}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-text-faint)]">Round {r.n}</p>
                        <h3 className="font-clash text-sm font-bold text-[var(--color-text)] truncate">{r.title}</h3>
                      </div>
                      <Icon size={16} className="text-[var(--color-accent-purple)] shrink-0" />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-bricolage leading-relaxed">{r.body}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Email capture — reuses the existing FreeTrialCTA section */}
        <FreeTrialCTA />

        {/* What you get + FAQ-lite */}
        <section className="py-14 sm:py-20" data-testid="free-mock-outcomes-section">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="font-clash text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-8 text-center">
              What you walk away with
            </h2>
            <ul className="space-y-3">
              {[
                'A round-by-round score (application, aptitude, HR, technical, case) with strengths and gaps',
                "Pari's verdict on whether you'd land the role — offer or reject — with the honest reasoning",
                'Your Excel work saved with a per-cell breakdown of what you got right and what you missed',
                'The exact questions you were asked — so you can rework the weak answers and try the paid course rounds next',
              ].map((line, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
                  data-testid={`free-mock-outcome-${idx}`}
                >
                  <CheckCircle2 size={18} className="text-[var(--color-success)] shrink-0 mt-0.5" />
                  <span className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>

            {/* Trust / eligibility strip */}
            <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--color-text-faint)] mb-3">
                Fine print
              </p>
              <ul className="space-y-1.5 text-xs text-[var(--color-text-muted)] font-bricolage">
                <li className="flex items-start gap-2"><Clock size={12} className="mt-0.5 shrink-0 text-[var(--color-accent-purple)]"/> Runs in about 30-45 minutes end-to-end.</li>
                <li className="flex items-start gap-2"><FileSpreadsheet size={12} className="mt-0.5 shrink-0 text-[var(--color-accent-pink)]"/> The Excel case is desktop/laptop-only.</li>
                <li className="flex items-start gap-2"><Users size={12} className="mt-0.5 shrink-0 text-[var(--color-primary)]"/> One free trial per person. No card, no signup, no calls.</li>
              </ul>
            </div>

            {/* Secondary CTA into the paid course */}
            <div className="mt-12 text-center">
              <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-4">
                Liked the trial? The full Equity Research Analyst Program has 21 modules and 239
                sessions — same interviewer, plus a curriculum, capstones and a certificate.
              </p>
              <Link
                to="/course/5f69ef74-9bff-4cb7-9b5d-68a82d9aad5c"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
                data-testid="free-mock-see-course-btn"
              >
                See the full course · ₹1,500 lifetime <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
