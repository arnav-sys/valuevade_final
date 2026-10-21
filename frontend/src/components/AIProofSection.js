import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { X, Check } from 'lucide-react';
import { BrandArtwork } from './brand/BrandArtwork';

/* Editorial finance AIProofSection (Feb 2026).
 * Copy verbatim. NeuralNetBg dialled back so it doesn't compete. */

const replacing = ['Junior Analyst', 'Report Writer', 'Data Screener'];
const irreplaceable = ['AI-Assisted Modelling', 'Python for Finance', 'Prompt Engineering', 'Strategic Judgement'];

export default function AIProofSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section
      id="ai-proof"
      className="relative py-24 lg:py-28 overflow-hidden bg-[var(--bg-primary)]"
      data-testid="ai-proof-section"
    >
      <div className="absolute inset-0 lv-terminal-grid pointer-events-none opacity-30" aria-hidden="true" />

      <div ref={sectionRef} className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="lv-chapter">§08 // AI-PROOF</span>
          <span className="h-px flex-1 max-w-32 bg-[var(--color-border)]" aria-hidden="true" />
          <span className="lv-chapter">THE SKILL NO ONE IS TEACHING</span>
        </div>

        <div className="max-w-3xl mb-12 lg:mb-16">
          <p className={`lv-chapter mb-4 text-[var(--color-accent-pink)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`} data-testid="ai-proof-badge">
            THE SKILL NO ONE IS TEACHING
          </p>
          <h2
            className={`font-clash text-3xl sm:text-4xl lg:text-[52px] text-[var(--color-text)] ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.1s', lineHeight: 1.06, letterSpacing: '-0.02em' }}
          >
            Finance jobs are changing.{' '}
            <span style={{ fontFamily: '"Newsreader", Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-primary)' }}>
              Your
            </span>{' '}
            skills should too.
          </h2>
          <div className="mt-6 h-px w-24 bg-[var(--color-primary)]/60" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          <div className={`${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`} style={{ animationDelay: '0.2s' }}>
            <p className="text-[var(--color-text-muted)] font-bricolage leading-relaxed text-[14.5px] lg:text-[15.5px] mb-6">
              AI is already replacing junior analysts, screeners, and report writers at major banks. But finance professionals who understand AI, who can use it, direct it, and build on top of it, are more valuable than ever.
            </p>
            <p className="text-[var(--color-text-muted)] font-bricolage leading-relaxed text-[14.5px] lg:text-[15.5px]">
              Every Valuevade roadmap includes the AI skills that make you irreplaceable: Python for finance, AI-assisted modelling, prompt engineering for analysts, and knowing exactly what AI can and cannot replace in your specific role.
            </p>
            <BrandArtwork variant="career" className="vv-section-art" testId="ai-proof-brand-artwork" />
          </div>

          <div
            className={`lv-panel overflow-hidden ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ animationDelay: '0.3s' }}
            data-testid="ai-proof-comparison-card"
          >
            <div className="grid grid-cols-2">
              <div className="p-6 border-r border-[var(--color-border)]" style={{ background: 'rgba(220, 38, 38, 0.05)' }}>
                <p className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-red-400/85 mb-4">
                  ROLES · REPLACED
                </p>
                <div className="space-y-3">
                  {replacing.map((role, i) => (
                    <div key={role} className="flex items-center gap-2">
                      <span className="font-jetbrains text-[10px] text-red-400/70">0{i + 1}</span>
                      <X size={12} className="text-red-400/60 flex-shrink-0" strokeWidth={2.5} />
                      <span className="text-[var(--color-text-faint)] text-[13px] line-through font-bricolage">{role}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
                  <span className="font-jetbrains text-[9.5px] uppercase tracking-[0.2em] text-red-400/70">
                    STATUS · AUTOMATED
                  </span>
                </div>
              </div>
              <div className="p-6" style={{ background: 'rgba(34, 197, 94, 0.05)' }}>
                <p className="font-jetbrains text-[10.5px] uppercase tracking-[0.2em] text-emerald-400/90 mb-4">
                  SKILLS · IRREPLACEABLE
                </p>
                <div className="space-y-3">
                  {irreplaceable.map((skill, i) => (
                    <div key={skill} className="flex items-center gap-2">
                      <span className="font-jetbrains text-[10px] text-emerald-400/80">0{i + 1}</span>
                      <Check size={12} className="text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                      <span className="text-[var(--color-text-secondary)] text-[13px] font-bricolage">{skill}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
                  <span className="font-jetbrains text-[9.5px] uppercase tracking-[0.2em] text-emerald-400/80">
                    STATUS · HIRING SIGNAL
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p
          className={`mt-14 text-[var(--color-accent-pink)] font-bricolage text-lg lg:text-xl ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.4s', fontStyle: 'italic' }}
          data-testid="ai-proof-emotional-line"
        >
          Don&apos;t just land the role. Make yourself impossible to replace.
        </p>
      </div>
    </section>
  );
}
