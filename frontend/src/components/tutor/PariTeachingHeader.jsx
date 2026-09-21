import AvatarPersona from './AvatarPersona';
import { TUTOR_NAME } from '../../contexts/TutorContext';

/**
 * Phase 56, small horizontal card that mounts above any Notes card body.
 * Pari pose + intro line are driven by `cardType`. Footprint is intentionally
 * tight (~64-80px tall) so it doesn't shove the existing card content far
 * down. Reused across Hook/Concept/Formula/Summary in the first wave.
 */

const NOTES_CARD_PARI = {
  hook: { pose: 'asking', message: () => "Here's something worth thinking about..." },
  concept: { pose: 'explaining', message: (t) => t ? `Let me explain "${t}" to you...` : "Let me walk you through this concept..." },
  formula: { pose: 'thinking', message: () => "Here's the formula, let me walk you through it..." },
  visual: { pose: 'explaining', message: () => "See how this works visually?" },
  deep_dive: { pose: 'thinking', message: () => "Deeper layer, stay with me..." },
  example: { pose: 'explaining', message: () => "Real example to make this stick..." },
  mistake: { pose: 'listening', message: () => "A common mistake students make..." },
  summary: { pose: 'encouraging', message: () => "Quick recap of what we covered..." },
};

export default function PariTeachingHeader({ cardType, cardTitle, accent = null, className = '' }) {
  const cfg = NOTES_CARD_PARI[cardType] || NOTES_CARD_PARI.concept;
  const message = typeof cfg.message === 'function' ? cfg.message(cardTitle) : cfg.message;
  const accentColor = accent || 'var(--color-primary)';
  return (
    <div
      className={`mb-4 sm:mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]/60 backdrop-blur p-2.5 sm:p-3 flex items-center gap-3 ${className}`}
      data-testid={`pari-teaching-${cardType}`}
    >
      <AvatarPersona
        pose={cfg.pose}
        size="sm"
        position="inline"
        showSpeechBubble={false}
        ariaLabel={TUTOR_NAME}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] mb-0.5"
          style={{ color: accentColor }}
        >
          {TUTOR_NAME} teaching
        </div>
        <div className="text-xs sm:text-sm text-[var(--color-text)] font-bricolage leading-snug">
          {message}
        </div>
      </div>
    </div>
  );
}

export { NOTES_CARD_PARI };
