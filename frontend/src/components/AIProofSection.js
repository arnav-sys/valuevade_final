import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { X, Check } from 'lucide-react';

const replacing = ['Junior Analyst', 'Report Writer', 'Data Screener'];
const irreplaceable = ['AI-Assisted Modelling', 'Python for Finance', 'Prompt Engineering', 'Strategic Judgement'];

export default function AIProofSection() {
  const [sectionRef, isVisible] = useScrollAnimation();

  return (
    <section
      id="ai-proof"
      className="relative py-24 lg:py-32 overflow-hidden bg-[var(--bg-primary)]"
      data-testid="ai-proof-section"
    >
      <div className="absolute top-0 left-0 w-full h-32" style={{ background: 'linear-gradient(135deg, rgba(36,107,253,0.08), rgba(106,92,255,0.08))' }} />

      <div ref={sectionRef} className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-6">
          <span
            className={`inline-block px-4 py-2 rounded-full border border-[var(--color-accent-pink)]/40 text-[var(--color-accent-pink)] text-sm font-jetbrains ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
            style={{ boxShadow: '0 0 16px rgba(255, 106, 193, 0.12)' }}
            data-testid="ai-proof-badge"
          >
            THE SKILL NO ONE IS TEACHING
          </span>
        </div>

        <h2
          className={`font-clash text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text)] text-center leading-tight mb-16 max-w-3xl mx-auto ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.1s' }}
        >
          Finance jobs are changing.<br />Your skills should too.
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div className={`${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`} style={{ animationDelay: '0.2s' }}>
            <p className="text-[var(--color-text-muted)] font-bricolage leading-relaxed text-sm lg:text-base mb-6">
              AI is already replacing junior analysts, screeners, and report writers at major banks. But finance professionals who understand AI — who can use it, direct it, and build on top of it — are more valuable than ever.
            </p>
            <p className="text-[var(--color-text-muted)] font-bricolage leading-relaxed text-sm lg:text-base">
              Every Valuevade roadmap includes the AI skills that make you irreplaceable: Python for finance, AI-assisted modelling, prompt engineering for analysts, and knowing exactly what AI can and cannot replace in your specific role.
            </p>
          </div>

          <div className={`glass-card rounded-2xl overflow-hidden ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`} style={{ animationDelay: '0.3s' }} data-testid="ai-proof-comparison-card">
            <div className="grid grid-cols-2">
              <div className="p-6 border-r border-[var(--color-border)]" style={{ background: 'rgba(220, 38, 38, 0.04)' }}>
                <p className="text-red-400/80 text-xs font-jetbrains uppercase tracking-wider mb-4">Roles AI is replacing</p>
                <div className="space-y-3">
                  {replacing.map((role) => (
                    <div key={role} className="flex items-center gap-2">
                      <X size={14} className="text-red-400/60 flex-shrink-0" />
                      <span className="text-[var(--color-text-faint)] text-sm line-through font-bricolage">{role}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6" style={{ background: 'rgba(34, 197, 94, 0.04)' }}>
                <p className="text-emerald-400/80 text-xs font-jetbrains uppercase tracking-wider mb-4">Skills that make you irreplaceable</p>
                <div className="space-y-3">
                  {irreplaceable.map((skill) => (
                    <div key={skill} className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-[var(--color-text-secondary)] text-sm font-bricolage">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p
          className={`text-center mt-16 text-[var(--color-accent-pink)] italic font-bricolage text-lg lg:text-xl ${isVisible ? 'animate-fade-up visible' : 'animate-fade-up'}`}
          style={{ animationDelay: '0.4s' }}
          data-testid="ai-proof-emotional-line"
        >
          Don't just land the role. Make yourself impossible to replace.
        </p>
      </div>
    </section>
  );
}
