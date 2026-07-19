/**
 * FaqChatbot — floating help bubble (bottom-right) that opens a search
 * modal. Type any question → top FAQ matches show inline with expandable
 * answers. Fully client-side, no network calls, no LLM cost.
 *
 * Usage: <FaqChatbot /> — mount once per page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, X, Search as SearchIcon, ChevronRight, MessageCircleQuestion } from 'lucide-react';
import { scoreFaq } from '../../data/faqs';
import { useFaqs } from '../../data/useFaqs';

const INITIAL_SUGGESTIONS = [
  'How much does the course cost?',
  'Do I get a certificate?',
  'Is there a free trial?',
  'How long does the course take?',
  'What is Pari?',
];

export default function FaqChatbot({ align = 'bottom-right' }) {
  const { faqs } = useFaqs();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const inputRef = useRef(null);

  // Focus the input as soon as the modal opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    if (!open) { setQ(''); setExpandedId(null); }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim();
    if (!query) return faqs.slice(0, 6);
    return faqs
      .map((f) => ({ faq: f, score: scoreFaq(f, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.faq);
  }, [q, faqs]);

  const positionClass = align === 'bottom-left' ? 'left-5 sm:left-8' : 'right-5 sm:right-8';

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open help chat"
          data-testid="faq-chatbot-bubble"
          className={`fixed ${positionClass} bottom-5 sm:bottom-8 z-40 group flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] shadow-[0_10px_40px_rgba(36,107,253,0.35)] hover:brightness-110 transition-all`}
        >
          <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
            <HelpCircle size={14} />
          </div>
          <span className="hidden sm:inline font-bricolage">Help</span>
        </button>
      )}

      {/* Modal / drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-3 py-5 sm:p-6"
          onClick={() => setOpen(false)}
          data-testid="faq-chatbot-overlay"
        >
          <div
            className="relative w-full sm:max-w-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
            data-testid="faq-chatbot-modal"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent-purple)] flex items-center justify-center shrink-0">
                <MessageCircleQuestion size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-clash text-base font-bold text-[var(--color-text)] leading-tight">Help centre</h3>
                <p className="text-[11px] text-[var(--color-text-muted)] font-bricolage">
                  Search anything about the course, pricing, or certificate
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                data-testid="faq-chatbot-close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search box */}
            <div className="px-5 pt-4">
              <div className="relative">
                <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setExpandedId(null); }}
                  placeholder="Type your question…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-primary)] text-[var(--color-text)] text-sm font-bricolage outline-none transition-colors"
                  data-testid="faq-chatbot-input"
                />
              </div>

              {/* Suggestion chips when empty */}
              {!q.trim() && (
                <div className="flex flex-wrap gap-1.5 mt-3" data-testid="faq-chatbot-suggestions">
                  {INITIAL_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQ(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/60 transition-all font-bricolage"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[200px]" data-testid="faq-chatbot-results">
              {results.length === 0 ? (
                <div className="text-center py-10" data-testid="faq-chatbot-no-results">
                  <p className="text-sm text-[var(--color-text-muted)] font-bricolage mb-2">
                    No FAQ matches for &quot;{q}&quot;.
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] font-bricolage">
                    Try different keywords, or email{' '}
                    <a href="mailto:support@valuevade.com" className="text-[var(--color-primary)] underline">
                      support@valuevade.com
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {results.map((faq) => {
                    const isExpanded = expandedId === faq.id;
                    return (
                      <li key={faq.id} data-testid={`faq-chatbot-result-${faq.id}`}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                          className={`w-full text-left rounded-xl border transition-all px-4 py-3 ${
                            isExpanded
                              ? 'border-[var(--color-primary)]/60 bg-[var(--color-primary)]/5'
                              : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-muted)]'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-primary)] mb-1">
                                {faq.category}
                              </div>
                              <div className="text-sm font-medium text-[var(--color-text)] font-bricolage">
                                {faq.question}
                              </div>
                              {isExpanded && (
                                <p
                                  className="text-sm text-[var(--color-text-muted)] font-bricolage leading-relaxed mt-2"
                                  data-testid={`faq-chatbot-answer-${faq.id}`}
                                >
                                  {faq.answer}
                                </p>
                              )}
                            </div>
                            <ChevronRight
                              size={14}
                              className={`shrink-0 mt-1 text-[var(--color-text-muted)] transition-transform ${isExpanded ? 'rotate-90 text-[var(--color-primary)]' : ''}`}
                            />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-between">
              <p className="text-[10px] text-[var(--color-text-muted)] font-bricolage">
                Can&apos;t find your answer?
              </p>
              <a
                href="mailto:support@valuevade.com"
                className="text-[11px] font-medium text-[var(--color-primary)] hover:underline font-bricolage"
                data-testid="faq-chatbot-contact-support"
              >
                Contact support →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
