import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AvatarPersona from './AvatarPersona';
import { TUTOR_NAME } from '../../contexts/TutorContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Phase 54 — P1
 * Full-screen welcome modal shown once per user after first enrollment.
 * Gated by `profiles.pari_welcomed_at` (timestamptz nullable).
 *
 * Mount this at the top of the dashboard (or any post-enrollment landing).
 * It fetches /api/me/pari_welcome on mount and renders only if
 * `should_show_welcome=true`. Dismiss → POST /api/me/pari_welcome/ack.
 */
export default function PariWelcomeModal({ onDismiss = () => {} }) {
  const [open, setOpen] = useState(false);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch(`${BACKEND}/api/me/pari_welcome`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (alive && json?.should_show_welcome) setOpen(true);
      } catch { /* fail silently — modal just doesn't show */ }
    })();
    return () => { alive = false; };
  }, []);

  const dismiss = async () => {
    if (acking) return;
    setAcking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch(`${BACKEND}/api/me/pari_welcome/ack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: '{}',
        });
      }
    } finally {
      setOpen(false);
      setAcking(false);
      onDismiss();
    }
  };

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pari-welcome-title"
      data-testid="pari-welcome-modal"
      className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4 py-8"
    >
      <div className="relative max-w-2xl w-full rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 sm:p-10 shadow-2xl">
        <div className="flex flex-col items-center text-center gap-5 sm:gap-6">
          <AvatarPersona
            pose="waving"
            size="fullscreen"
            position="inline"
            showSpeechBubble={false}
            ariaLabel={`${TUTOR_NAME}, your AI tutor`}
          />
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <Sparkles size={12} className="text-[var(--color-primary)]" />
              <span>your AI finance tutor</span>
            </div>
            <h1
              id="pari-welcome-title"
              className="font-clash text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text)] leading-tight"
            >
              Hi, I'm {TUTOR_NAME}.
            </h1>
            <p className="font-bricolage text-base sm:text-lg text-[var(--color-text-muted)] max-w-xl mx-auto leading-relaxed">
              I'll walk you through every concept, ask you questions, and answer your doubts as you learn.
              Let's get started — your finance career is going to be fun.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            disabled={acking}
            data-testid="pari-welcome-cta"
            className="rounded-full bg-[var(--color-primary)] hover:brightness-110 disabled:opacity-60 text-white px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold font-bricolage shadow-lg"
          >
            {acking ? 'Saving…' : "Let's start learning"}
          </button>
        </div>
      </div>
    </div>
  );
}
