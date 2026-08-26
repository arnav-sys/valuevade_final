{/* DRAFT - requires founder review before production */}
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Terms of Service — DRAFT (Prompt-4 of the Aug-2026 SEO/GEO rebuild).
 * Covers: service description, ₹1,500 one-time personal-use lifetime licence,
 * account rules, no job guarantees, IP of course content, limitation of
 * liability, governing law India. Requires founder + counsel review.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--color-text)]">
      <Helmet>
        <title>Terms of Service | Valuevade</title>
        <meta name="description" content="Terms of Service for Valuevade — ₹1,500 one-time lifetime access licence, account rules, IP, and disclaimers." />
        <link rel="canonical" href="https://valuevade.com/terms" />
      </Helmet>
      <main className="max-w-3xl mx-auto px-6 py-14 sm:py-20">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8"
          data-testid="legal-back-link"
        >
          <ArrowLeft size={16} /> Home
        </Link>
        <h1 className="font-clash text-3xl sm:text-4xl font-bold mb-3" data-testid="legal-title">Terms of Service</h1>
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-10" data-testid="legal-last-updated">
          Last updated: 25 August 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed" data-testid="legal-body">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of
            valuevade.com and the Valuevade learning platform (the &quot;Service&quot;),
            operated by Valuevade (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), a
            sole-proprietor entity based in India. By creating an account or paying
            for a course, you accept these Terms.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">The Service</h2>
          <p>
            Valuevade is a self-paced online learning platform. Our flagship product is
            the Equity Research Analyst Program: 21 modules, 239 hands-on sessions on
            Indian companies, 3 capstone projects, an AI tutor (Pari), AI mock interviews,
            NISM Series XV certification preparation, and a downloadable
            Certificate of Completion. The first session is free; the full programme
            costs ₹1,500 as a one-time payment.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Your licence</h2>
          <p>
            When you complete a ₹1,500 one-time payment, we grant you a
            <strong> non-exclusive, non-transferable, personal-use licence</strong> to
            access all included course content for the operational lifetime of the
            Valuevade platform (&quot;lifetime access&quot;). The licence does not include
            the right to record, download, redistribute, resell, or use course
            content to train machine-learning models, whether commercial or otherwise.
            One account is one licence — sharing your login with someone else is a
            material breach and grounds for account termination without refund.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Account rules</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>You must be at least 13 years old to create an account, and at least 18 to purchase.</li>
            <li>You are responsible for keeping your credentials confidential and for any activity under your account.</li>
            <li>Do not attempt to reverse-engineer, scrape, or programmatically extract course content, quizzes, or simulations. Automated access outside of documented APIs is prohibited.</li>
            <li>Do not upload unlawful, infringing or abusive content into any user-generated field (doubt chats, capstone submissions, portfolio uploads).</li>
          </ul>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">No job guarantee</h2>
          <p>
            Valuevade prepares you for equity research and financial modelling roles,
            and the programme is built around the artefacts recruiters look for
            (portfolio deliverables, NISM prep, scored mock-interview practice).
            <strong> We do not promise, guarantee, or contractually commit to any specific
            job outcome, interview, offer, or salary.</strong> Employment outcomes depend
            on many factors outside our control.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Intellectual property</h2>
          <p>
            All course content — video lectures, notes, quizzes, simulations, case
            studies, model answers, code, and the platform itself — is owned by or
            licensed to Valuevade and is protected under Indian and international
            copyright and trademark law. You retain ownership of the content you
            create (capstone reports, portfolio uploads); by submitting it to the
            Service you grant Valuevade a limited licence to store, display and
            grade it in the ordinary course of running the platform.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Valuevade&apos;s aggregate liability
            arising out of or relating to the Service is limited to the amount you paid
            us for the Service in the twelve months preceding the claim (i.e. up to
            ₹1,500 for a one-time-payment user). Valuevade is not liable for indirect,
            incidental, or consequential damages including but not limited to lost
            profits, lost employment opportunities, or lost data.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Termination</h2>
          <p>
            You may close your account at any time by emailing support@valuevade.com.
            We may suspend or terminate accounts that materially breach these Terms
            (e.g. content redistribution, credential sharing, scraping). Refund
            eligibility on termination follows the Refund &amp; Cancellation Policy.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Governing law</h2>
          <p>
            These Terms are governed by the laws of India. Disputes will be subject to
            the exclusive jurisdiction of the courts at Delhi.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Changes</h2>
          <p>
            We may update these Terms as the product evolves. Material changes will be
            surfaced by email or an in-app notice. Continued use of the Service after a
            change constitutes acceptance.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Contact</h2>
          <p>
            Questions about these Terms? Email <a className="text-[var(--color-primary)] hover:underline" href="mailto:support@valuevade.com">support@valuevade.com</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
