{/* DRAFT - requires founder review before production */}
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Privacy Policy — DRAFT (Prompt-4 of the Aug-2026 SEO/GEO rebuild).
 * Reflects the actual product surface: Supabase for auth + progress data,
 * Razorpay for payments (no card data stored client-side or by us), no
 * third-party analytics currently deployed, DPDP-Act delete SLA of 30 days.
 * The founder MUST review this page (and consult counsel) before it goes live.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--color-text)]">
      <Helmet>
        <title>Privacy Policy | Valuevade</title>
        <meta name="description" content="Valuevade's privacy policy — what we collect, how we use it, and your rights under India's DPDP Act." />
        <link rel="canonical" href="https://valuevade.com/privacy" />
      </Helmet>
      <main className="max-w-3xl mx-auto px-6 py-14 sm:py-20">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8"
          data-testid="legal-back-link"
        >
          <ArrowLeft size={16} /> Home
        </Link>
        <h1 className="font-clash text-3xl sm:text-4xl font-bold mb-3" data-testid="legal-title">Privacy Policy</h1>
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-10" data-testid="legal-last-updated">
          Last updated: 25 August 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed" data-testid="legal-body">
          <p>
            This Privacy Policy explains how Valuevade (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
            handles personal information of visitors and enrolled students on
            valuevade.com and its subdomains (the &quot;Service&quot;). We are a solo-founder
            startup based in India and we take data-minimisation seriously — we collect
            only what we need to give you the course experience you paid for.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">What we collect</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Account details</strong> you provide at signup: your name, email address, and a hashed password. If you choose social sign-in, we also receive whatever identifiers your provider hands us (typically name and email).</li>
            <li><strong>Progress data</strong> generated as you use the Service: which sessions you completed, quiz answers, simulation submissions, mock-interview transcripts, XP, streaks, badges, and doubt-chat history. This is stored so the platform can pick up where you left off and grade your work.</li>
            <li><strong>Payment metadata</strong>: order ID, payment ID, and status returned by Razorpay after checkout. <strong>We never see or store your card, UPI, or net-banking credentials</strong> — Razorpay handles that. If you use international card checkout, the same applies via Razorpay&apos;s underlying processor.</li>
            <li><strong>Support correspondence</strong> — anything you email to support@valuevade.com is kept as long as needed to resolve your ticket.</li>
          </ul>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Cookies and analytics</h2>
          <p>
            Valuevade uses only functional cookies required for authentication and
            session persistence (issued by Supabase, our auth and database provider).
            We do not currently deploy Google Analytics, PostHog, Mixpanel, Hotjar,
            Meta Pixel, or any other third-party analytics or advertising SDK. If
            this changes in future, we will update this policy and this page will
            reflect the exact tools in use.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">How we use your data</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Delivering the course: showing you the right modules, grading simulations, generating your certificate.</li>
            <li>Personalisation: our AI tutor (Pari) uses the context of the note, quiz, or simulation you&apos;re currently on to answer your doubts.</li>
            <li>Account operations: password resets, email changes, payment receipts.</li>
            <li>Product improvement: aggregated, non-identifying metrics on which sessions students struggle with, so we can improve the curriculum.</li>
            <li>Legal compliance and preventing abuse.</li>
          </ul>
          <p>We do <strong>not</strong> sell your personal data. We do not use it to train third-party AI models.</p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Who else touches your data</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Supabase</strong> — hosts our database, authentication, and file storage.</li>
            <li><strong>Razorpay</strong> — processes your payments.</li>
            <li><strong>OpenAI, Anthropic, Google (via Emergent LLM key)</strong> — provide the language and voice models that power Pari, mock interviews and AI evaluation. Interview transcripts and doubt messages are transmitted to these providers as necessary to generate a response; we do not use their APIs&apos; opt-in training paths.</li>
          </ul>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Your rights under India&apos;s DPDP Act</h2>
          <p>
            You can request access to, correction of, or deletion of any personal
            data we hold about you by emailing <a className="text-[var(--color-primary)] hover:underline" href="mailto:support@valuevade.com">support@valuevade.com</a>.
            We honour deletion requests within 30 days. Deletion is permanent — your
            progress, certificate record and doubt history cannot be recovered
            after we complete the request.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Contact & governing law</h2>
          <p>
            Questions about this policy? Email <a className="text-[var(--color-primary)] hover:underline" href="mailto:support@valuevade.com">support@valuevade.com</a>.
            This policy is governed by the laws of India; disputes will be subject to
            the exclusive jurisdiction of courts at Delhi.
          </p>
        </div>
      </main>
    </div>
  );
}
