{/* DRAFT - requires founder review before production */}
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Refund & Cancellation Policy, DRAFT (Prompt-4 of the Aug-2026 SEO/GEO
 * rebuild). Since Prompt 4 shipped without the two "ready-made" refund
 * options referenced in its slot notes, this draft picks a widely-used
 * software-course model that fits the ₹4999 / free-first-session product:
 *   - Free first session doubles as the "try before you buy" window.
 *   - After paid access is granted, no refund by default (you already tried
 *     the product).
 *   - Exceptions granted case-by-case for genuine technical inability to
 *     access the course, or duplicate charges, contactable via support.
 *
 * The founder MUST review this policy (and consult counsel) before it goes
 * live, and may want to add a scheduled cooling-off window (e.g. 7 days
 * from purchase, with unused-access clauses) for RBI / consumer-protection
 * compliance depending on final legal advice.
 */
export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--color-text)]">
      <Helmet>
        <title>Refund & Cancellation Policy | Valuevade</title>
        <meta name="description" content="Valuevade's refund and cancellation policy for the ₹4999 lifetime Equity Research Analyst Program." />
        <link rel="canonical" href="https://valuevade.com/refund-policy" />
      </Helmet>
      <main className="max-w-3xl mx-auto px-6 py-14 sm:py-20">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8"
          data-testid="legal-back-link"
        >
          <ArrowLeft size={16} /> Home
        </Link>
        <h1 className="font-clash text-3xl sm:text-4xl font-bold mb-3" data-testid="legal-title">Refund &amp; Cancellation Policy</h1>
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-text-faint)] mb-10" data-testid="legal-last-updated">
          Last updated: 25 August 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm sm:text-base text-[var(--color-text-muted)] font-bricolage leading-relaxed" data-testid="legal-body">
          <p>
            Valuevade sells the Equity Research Analyst Program as a one-time
            ₹4999 lifetime licence. This policy explains when refunds are and
            aren&apos;t available.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Try before you buy</h2>
          <p>
            Every visitor gets one full session, notes, quiz, mock interview
            and simulation, free of charge, no card required. This exists so
            you can judge the quality of the product before committing to the
            ₹4999 payment. Please use it.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Refunds after paid access</h2>
          <p>
            Because full course access, including the AI tutor, simulations,
            mock interviews, and downloadable materials, is unlocked
            immediately on payment, we do not offer refunds by default once your
            account has been granted paid access. Change-of-mind requests
            (&quot;I&apos;m too busy&quot;, &quot;I found a different course&quot;)
            fall outside standard eligibility, since the free first session was
            the intended evaluation window.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Case-by-case exceptions</h2>
          <p>
            We do consider refunds on a case-by-case basis for the following
            situations, at our sole discretion:
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Duplicate charges</strong> or Razorpay processing errors, refunded in full within 7 working days of confirmation.</li>
            <li><strong>Genuine inability to access the course</strong> for reasons on our side (persistent platform outage, licence not provisioned) that our support team cannot resolve.</li>
            <li><strong>Regulatory obligations</strong> under Indian consumer-protection or RBI rules that entitle you to a refund.</li>
          </ul>
          <p>
            All exception requests must be sent to
            <a className="text-[var(--color-primary)] hover:underline" href="mailto:support@valuevade.com"> support@valuevade.com</a> with
            your order ID, payment ID, and a short description of the issue.
            We aim to respond within 3 working days.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Cancellation</h2>
          <p>
            You may close your account at any time by emailing support. Because
            the product is a one-time-payment lifetime licence (not a
            subscription), there is nothing to cancel from a billing standpoint,
            you simply stop using the Service. Closing your account does not
            entitle you to a refund of a previously paid one-time fee, subject
            to the exceptions above.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Refund method &amp; timing</h2>
          <p>
            Approved refunds are processed back to the original payment method
            via Razorpay. Once approved, bank/UPI reversals typically clear in
            5–10 working days.
          </p>

          <h2 className="font-clash text-xl font-semibold text-[var(--color-text)] mt-8 mb-2">Contact</h2>
          <p>
            Refund questions? Email <a className="text-[var(--color-primary)] hover:underline" href="mailto:support@valuevade.com">support@valuevade.com</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
