import { useEffect, useState } from 'react';

/**
 * On-brand loader for AI-driven waits (mock interview scoring, simulation
 * setup, quiz/exam prep). Ticker-bar + spinning ring motif, colours pulled
 * from CSS vars so it adapts automatically to light/dark theme.
 */
const DEFAULT_MESSAGES = ['Working on it…', 'Almost there…'];

export default function AILoader({
  variant = 'inline',
  title = 'Working on it',
  messages = DEFAULT_MESSAGES,
  testid = 'ai-loader',
}) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 2200);
    return () => clearInterval(t);
  }, [messages.length]);

  const content = (
    <div className="flex flex-col items-center justify-center gap-6 py-10" data-testid={testid} role="status" aria-live="polite">
      <div className="relative w-24 flex flex-col items-center justify-center" aria-hidden="true">
        <img src="/brand/claude-2.webp" alt="" className="w-24 h-24 object-contain" />
        <div className="flex items-end justify-center gap-1.5 h-7">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1.5 rounded-full"
              style={{
                height: '8px',
                background: i % 2 === 0 ? 'var(--color-primary)' : 'var(--color-accent-purple)',
                animation: `ai-loader-bar 1s ease-in-out ${i * 0.12}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="text-center px-4">
        <p className="font-clash text-sm sm:text-base font-semibold text-[var(--color-text)] mb-1.5" data-testid={`${testid}-title`}>{title}</p>
        <p
          key={msgIdx}
          className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--color-text-muted)]"
          style={{ animation: 'fadeIn 0.4s ease' }}
          data-testid={`${testid}-message`}
        >
          {messages[msgIdx]}
        </p>
      </div>
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-[var(--bg-primary)]/85 backdrop-blur-md"
        data-testid={`${testid}-overlay`}
      >
        {content}
      </div>
    );
  }

  return content;
}
