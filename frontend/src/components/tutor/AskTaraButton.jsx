import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTutor, TUTOR_NAME } from '../../contexts/TutorContext';
import DoubtsSession from './DoubtsSession';

// Lightweight trigger that opens the DoubtsSession modal. Designed for any
// learning surface — pass the phase + module + course session id and we'll
// hand them off to the backend.
//
// Props
//   phase             one of 'notes'|'quiz'|'interview'|'simulation'|
//                     'project'|'capstone'|'dashboard'|'module_complete'
//   moduleCode        'M0', 'M1', ... (optional, used for cache scope + prompt)
//   courseSessionId   uuid of the user_session this doubt is anchored to
//   variant           'pill' (default, compact) | 'card' (full-width row)
//   autoPrompt        when truthy, shows a small "Got any doubts?" banner that
//                     auto-dismisses after 8s. Set true on quiz/sim < 70%.
//   autoPromptCopy    optional override for the banner copy.

export default function AskTaraButton({
  phase = 'dashboard',
  moduleCode = null,
  courseSessionId = null,
  variant = 'pill',
  autoPrompt = false,
  autoPromptCopy = null,
  className = '',
}) {
  const { enabled } = useTutor();
  const [open, setOpen] = useState(false);
  const [promptShown, setPromptShown] = useState(autoPrompt);
  const [promptDismissed, setPromptDismissed] = useState(false);

  useEffect(() => {
    if (!autoPrompt || promptDismissed) return undefined;
    const t = setTimeout(() => setPromptShown(false), 8000);
    return () => clearTimeout(t);
  }, [autoPrompt, promptDismissed]);

  const handleClick = useCallback(() => {
    setOpen(true);
    setPromptShown(false);
    setPromptDismissed(true);
  }, []);

  if (!enabled) return null;

  return (
    <>
      {variant === 'card' ? (
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface)] px-4 py-3 transition-colors text-left ${className}`}
          data-testid="ask-tara-btn-card"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
            <img src="/tutor/tara_listening.png" alt="" className="w-10 h-10 object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-clash font-bold text-[var(--color-text)]">Ask {TUTOR_NAME} a doubt?</div>
            <div className="text-xs text-[var(--color-text-muted)]">3 turns · 5 sessions per day</div>
          </div>
          <Sparkles size={14} className="text-[var(--color-accent)] shrink-0" />
        </button>
      ) : (
        <button
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 text-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold font-bricolage transition-colors ${className}`}
          data-testid="ask-tara-btn-pill"
        >
          <Sparkles size={12} /> Ask {TUTOR_NAME}
        </button>
      )}

      {/* Auto-prompt banner — only when autoPrompt prop was true (low-score surfaces) */}
      {promptShown && !open && (
        <div
          className="fixed bottom-24 right-4 z-30 max-w-xs rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl p-3"
          data-testid="ask-tara-autoprompt"
        >
          <div className="text-xs text-[var(--color-text)] mb-2 font-bricolage">
            {autoPromptCopy || "Got any doubts before moving on?"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClick}
              className="flex-1 text-xs rounded-full bg-[var(--color-primary)] text-white py-1.5 font-semibold"
              data-testid="ask-tara-autoprompt-open"
            >
              Ask {TUTOR_NAME}
            </button>
            <button
              onClick={() => { setPromptShown(false); setPromptDismissed(true); }}
              className="text-xs rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] px-3 py-1.5"
              data-testid="ask-tara-autoprompt-skip"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      <DoubtsSession
        open={open}
        onClose={() => setOpen(false)}
        phase={phase}
        moduleCode={moduleCode}
        courseSessionId={courseSessionId}
      />
    </>
  );
}
