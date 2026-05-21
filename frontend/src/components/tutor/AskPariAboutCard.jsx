import { MessageCircleQuestion } from 'lucide-react';
import { useDoubtsLauncher } from '../../contexts/DoubtsLauncherContext';

/**
 * Phase 56 — small "Ask Pari about this card" launcher mounted at the bottom
 * of any Notes card body. Carries the card_title + card_content as
 * attempt_context so Pari can explain THIS specific card.
 */
export default function AskPariAboutCard({
  cardTitle,
  cardContent,
  cardType = 'notes',
  moduleCode = null,
  courseSessionId = null,
  className = '',
  testid,
}) {
  const { openDoubts } = useDoubtsLauncher();

  // Trim card_content to keep the attempt_context payload reasonable —
  // Pari only needs the gist for grounding, not the full HTML.
  const compactContent = (() => {
    try {
      if (typeof cardContent === 'string') return cardContent.slice(0, 1600);
      const s = JSON.stringify(cardContent);
      return (s || '').slice(0, 1600);
    } catch {
      return '';
    }
  })();

  const onClick = () => {
    openDoubts({
      phase: 'notes',
      moduleCode,
      courseSessionId,
      attemptContext: {
        card_type: cardType,
        card_title: cardTitle || '',
        card_content: compactContent,
      },
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/25 border border-[var(--color-primary)]/35 text-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold font-bricolage transition-colors ${className}`}
      data-testid={testid || `ask-pari-about-${cardType}`}
    >
      <MessageCircleQuestion size={12} /> Ask Pari about this
    </button>
  );
}
