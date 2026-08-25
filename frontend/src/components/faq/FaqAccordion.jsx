/**
 * FaqAccordion — landing-page FAQ section. Groups the shared FAQS constant
 * by category and renders as an accessible accordion. Client-side only —
 * no network.
 */
import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useFaqs, FAQ_CATEGORIES } from '../../data/useFaqs';
import { buildFaqPageJsonLd } from '../landing/jsonLd';

export default function FaqAccordion() {
  const { faqs, loading } = useFaqs();
  const [openId, setOpenId] = useState(null);
  const [activeCat, setActiveCat] = useState('All');

  // FAQPage JSON-LD wired to the SAME `faqs` array that renders the visible
  // accordion — one source of truth, so any admin edit changes the schema
  // automatically (per Prompt 4 rule).
  const faqSchema = useMemo(() => buildFaqPageJsonLd(faqs), [faqs]);

  const visible = useMemo(() => {
    if (activeCat === 'All') return faqs;
    return faqs.filter(f => f.category === activeCat);
  }, [activeCat, faqs]);

  // Derive the category list dynamically from the loaded FAQs so admin-added
  // categories show up automatically. Fallback to the static list.
  const catsFromData = useMemo(() => {
    const set = new Set(faqs.map(f => f.category).filter(Boolean));
    const dyn = Array.from(set);
    return dyn.length ? dyn : FAQ_CATEGORIES;
  }, [faqs]);

  return (
    <section
      id="faq"
      className="relative max-w-3xl mx-auto px-6 py-20 sm:py-28"
      data-testid="landing-faq-section"
    >
      {faqs.length > 0 && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        </Helmet>
      )}
      {/* Eyebrow */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-primary)]">
          <HelpCircle size={11} /> FAQ
        </div>
      </div>

      <h2
        className="font-clash text-center text-4xl sm:text-5xl font-bold text-[var(--color-text)] leading-[1.05] mb-4"
        data-testid="landing-faq-heading"
      >
        Questions,
        <br />
        <span className="bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent-purple)] to-[var(--color-accent-pink)] bg-clip-text text-transparent">
          answered.
        </span>
      </h2>
      <p className="text-center text-base font-bricolage text-[var(--color-text-muted)] max-w-xl mx-auto mb-3">
        Everything you might want to know about the course, pricing, certificate, and support.
      </p>
      <p className="text-center text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-faint)] mb-8" data-testid="faq-last-updated">
        Last updated: 25 August 2026
      </p>

      {/* Category filter chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-8" data-testid="faq-category-filter">
        {['All', ...catsFromData].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { setActiveCat(cat); setOpenId(null); }}
            data-testid={`faq-cat-${cat.toLowerCase()}`}
            className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-all border ${
              activeCat === cat
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-text-muted)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Accordion */}
      <div className="space-y-3" data-testid="faq-list">
        {visible.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div
              key={faq.id}
              className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]/60 backdrop-blur-sm overflow-hidden transition-all ${isOpen ? 'shadow-[0_0_30px_rgba(36,107,253,0.08)]' : ''}`}
              data-testid={`faq-item-${faq.id}`}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                data-testid={`faq-toggle-${faq.id}`}
              >
                <span className="font-bricolage text-[var(--color-text)] text-sm sm:text-base font-medium">
                  {faq.question}
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-[var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`}
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <p
                    className="px-5 pb-5 text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed"
                    data-testid={`faq-answer-${faq.id}`}
                  >
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="text-center text-sm text-[var(--color-text-muted)] font-bricolage mt-8">
          {loading ? 'Loading FAQs…' : 'Nothing in this category yet.'}
        </p>
      )}

      <p className="text-center text-xs text-[var(--color-text-muted)] font-bricolage mt-12">
        Still stuck? Click the <span className="text-[var(--color-primary)] font-medium">Help</span> bubble in the corner and search for anything.
      </p>
    </section>
  );
}
