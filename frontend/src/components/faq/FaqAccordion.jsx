/**
 * FaqAccordion, editorial finance / Bloomberg-terminal treatment (Feb 2026).
 * Content copy, categories, and dynamic loading behaviour verbatim.
 */
import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronDown } from 'lucide-react';
import { useFaqs, FAQ_CATEGORIES } from '../../data/useFaqs';
import { buildFaqPageJsonLd } from '../landing/jsonLd';

export default function FaqAccordion() {
  const { faqs, loading } = useFaqs();
  const [openId, setOpenId] = useState(null);
  const [activeCat, setActiveCat] = useState('All');

  const faqSchema = useMemo(() => buildFaqPageJsonLd(faqs), [faqs]);

  const visible = useMemo(() => {
    if (activeCat === 'All') return faqs;
    return faqs.filter(f => f.category === activeCat);
  }, [activeCat, faqs]);

  const catsFromData = useMemo(() => {
    const set = new Set(faqs.map(f => f.category).filter(Boolean));
    const dyn = Array.from(set);
    return dyn.length ? dyn : FAQ_CATEGORIES;
  }, [faqs]);

  return (
    <section
      id="faq"
      className="relative max-w-4xl mx-auto px-6 py-20 sm:py-24"
      data-testid="landing-faq-section"
    >
      {faqs.length > 0 && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        </Helmet>
      )}

      {/* Chapter rail */}
      <div className="flex items-center gap-3 mb-10">
        <span className="lv-chapter">§10 // FAQ</span>
        <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
        <span className="lv-chapter" data-testid="faq-last-updated">LAST UPDATED · 25 AUG 2026</span>
      </div>

      <div className="mb-10">
        <p className="lv-chapter mb-4">FREQUENTLY ASKED</p>
        <h2
          className="font-clash text-3xl sm:text-4xl lg:text-[52px] text-[var(--color-text)]"
          style={{ lineHeight: 1.06, letterSpacing: '-0.02em' }}
          data-testid="landing-faq-heading"
        >
          Questions,{' '}
          <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
            answered.
          </span>
        </h2>
        <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        <p className="mt-6 text-[14.5px] font-bricolage text-[var(--color-text-muted)] max-w-2xl leading-relaxed">
          Everything you might want to know about the course, pricing, certificate, and support.
        </p>
      </div>

      {/* Category filter, mono terminal chips */}
      <div className="flex flex-wrap gap-2 mb-8" data-testid="faq-category-filter">
        {['All', ...catsFromData].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { setActiveCat(cat); setOpenId(null); }}
            data-testid={`faq-cat-${cat.toLowerCase()}`}
            className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
              activeCat === cat
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]'
            }`}
            style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Accordion, datagrid-styled rows */}
      <div className="lv-panel divide-y divide-[var(--color-border)]" data-testid="faq-list">
        {visible.map((faq, idx) => {
          const isOpen = openId === faq.id;
          return (
            <div key={faq.id} data-testid={`faq-item-${faq.id}`}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left group"
                data-testid={`faq-toggle-${faq.id}`}
              >
                <div className="flex items-baseline gap-4 min-w-0">
                  <span className="text-[13px] font-bold text-[var(--color-primary)] shrink-0" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-bricolage text-[var(--color-text)] text-[14.5px] font-medium">
                    {faq.question}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className={`shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-5 pl-[68px]">
                    <p
                      className="text-[13.5px] text-[var(--color-text-muted)] font-bricolage leading-relaxed"
                      data-testid={`faq-answer-${faq.id}`}
                    >
                      {faq.answer}
                    </p>
                  </div>
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

      <p className="mt-10 text-[13.5px] font-bricolage text-[var(--color-text-muted)]">
        Still stuck? Open the{' '}
        <span className="text-[var(--color-primary)] font-semibold">Help</span> bubble anytime and Pari will answer in context.
      </p>
    </section>
  );
}
