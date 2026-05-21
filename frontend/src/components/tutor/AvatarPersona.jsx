import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTutor, TUTOR_NAME } from '../../contexts/TutorContext';
import { useDoubtsLauncher } from '../../contexts/DoubtsLauncherContext';

// Phase 51 — AvatarPersona
//
// Renders Pari, the AI tutor persona, as a stylized 3D-illustration character
// with subtle CSS-driven micro-animations and an optional glass speech bubble.
// All pose images live at /tutor/<slug>.png and are pre-generated via
// nano-banana with the user's reference photos.
//
// Props
//   pose             — one of the manifest slugs (without the `pari_` prefix
//                      OR with it; both forms accepted)
//   size             — 'sm' | 'md' | 'lg' | 'fullscreen'
//   message          — optional string. When provided, a speech bubble renders
//                      next to her with a small typewriter reveal.
//   position         — 'bottom-right' | 'bottom-left' | 'top-right' |
//                      'top-left' | 'inline'. Defaults to 'inline'.
//   showSpeechBubble — bool. If false, message is ignored.
//   onMessageEnd     — called when the typewriter completes. No-op default;
//                      Phase 52 (Doubts) will use it to chain TTS.
//   ariaLabel        — overrides the default "Pari, your AI tutor" announce.
//   onClick          — optional click handler for the avatar itself.

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// Normalise pose names: accept both "idle" and "pari_idle".
function normalizePoseSlug(pose) {
  if (!pose) return 'pari_idle';
  return pose.startsWith('pari_') ? pose : `pari_${pose}`;
}

const SIZE_MAP = {
  sm: { box: 'w-16 h-16',  img: 'w-16 h-16',  bubbleMax: 'max-w-[200px]' },
  md: { box: 'w-28 h-28',  img: 'w-28 h-28',  bubbleMax: 'max-w-[300px]' },
  lg: { box: 'w-44 h-44',  img: 'w-44 h-44',  bubbleMax: 'max-w-[420px]' },
  fullscreen: { box: 'w-72 h-72 sm:w-96 sm:h-96', img: 'w-72 h-72 sm:w-96 sm:h-96', bubbleMax: 'max-w-[560px]' },
};

const POSITION_CLASSES = {
  'bottom-right': 'fixed bottom-4 right-4 z-30',
  'bottom-left':  'fixed bottom-4 left-4 z-30',
  'top-right':    'fixed top-4 right-4 z-30',
  'top-left':     'fixed top-4 left-4 z-30',
  'inline':       'relative',
};

export default function AvatarPersona({
  pose = 'idle',
  size = 'md',
  message = null,
  position = 'inline',
  showSpeechBubble = true,
  onMessageEnd = () => {},
  ariaLabel = null,
  onClick = null,
  className = '',
  bubbleDismissable = true,
  autoDismissMs = null,
  clickToOpenDoubts = false,
  doubtsPhase = 'dashboard',
  doubtsModuleCode = null,
  doubtsCourseSessionId = null,
  doubtsAttemptContext = null,
}) {
  const { enabled } = useTutor();
  const { openDoubts } = useDoubtsLauncher();
  const reducedMotion = useMemo(prefersReducedMotion, []);

  // Cross-fade between poses: keep both the current and the next image
  // mounted during transitions so the cross-fade looks smooth.
  const slug = normalizePoseSlug(pose);
  const [activeSlug, setActiveSlug] = useState(slug);
  const [previousSlug, setPreviousSlug] = useState(null);
  const fadeTimerRef = useRef(null);

  useEffect(() => {
    if (slug === activeSlug) return undefined;
    setPreviousSlug(activeSlug);
    setActiveSlug(slug);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setPreviousSlug(null);
      fadeTimerRef.current = null;
    }, 260); // matches the .vv-avatar-fade transition duration
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [slug, activeSlug]);

  // Speech-bubble state — typewriter reveal + dismiss.
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    setBubbleDismissed(false);
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    if (!message) {
      setDisplayedMessage('');
      return undefined;
    }
    if (reducedMotion) {
      setDisplayedMessage(message);
      onMessageEnd();
      return undefined;
    }
    let i = 0;
    setDisplayedMessage('');
    typingTimerRef.current = setInterval(() => {
      i += 1;
      setDisplayedMessage(message.slice(0, i));
      if (i >= message.length) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        onMessageEnd();
      }
    }, 30);
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [message, reducedMotion, onMessageEnd]);

  // Auto-dismiss: when autoDismissMs is provided, dismiss the speech bubble
  // automatically after the typewriter completes (or immediately at mount if
  // reduced-motion). Caller-controlled — currently used by the dashboard
  // greeting so it doesn't loiter. Other surfaces keep the bubble open.
  useEffect(() => {
    if (!message || !autoDismissMs || autoDismissMs <= 0) return undefined;
    if (bubbleDismissed) return undefined;
    const t = setTimeout(() => setBubbleDismissed(true), autoDismissMs);
    return () => clearTimeout(t);
  }, [message, autoDismissMs, bubbleDismissed]);

  if (!enabled) return null;

  const sizeCfg = SIZE_MAP[size] || SIZE_MAP.md;
  const posCfg = POSITION_CLASSES[position] || POSITION_CLASSES.inline;
  const showBubble = showSpeechBubble && message && !bubbleDismissed;

  // P54: when clickToOpenDoubts is true and no explicit onClick, route the
  // avatar click to the DoubtsLauncher.
  const effectiveOnClick = onClick || (clickToOpenDoubts
    ? () => openDoubts({
        phase: doubtsPhase,
        moduleCode: doubtsModuleCode,
        courseSessionId: doubtsCourseSessionId,
        attemptContext: doubtsAttemptContext,
      })
    : null);

  const interactive = !!effectiveOnClick;
  const animClass = reducedMotion ? '' : 'vv-avatar-breathing';
  const hoverWiggle = !reducedMotion && (size === 'lg' || size === 'fullscreen') ? 'vv-avatar-hover-wiggle' : '';
  const hoverScale = !reducedMotion && interactive ? 'vv-avatar-hover-scale' : '';

  const completeTypewriter = () => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
      setDisplayedMessage(message);
      onMessageEnd();
    }
  };

  return (
    <div className={`${posCfg} ${className}`} data-testid={`tutor-persona-${size}`}>
      <div className={`flex ${size === 'fullscreen' ? 'flex-col items-center gap-3' : 'items-end gap-3'}`}>
        <button
          type="button"
          onClick={effectiveOnClick || undefined}
          aria-label={ariaLabel || `${TUTOR_NAME}, your AI tutor`}
          className={`relative ${sizeCfg.box} flex-shrink-0 ${interactive ? 'cursor-pointer' : 'cursor-default'} ${hoverWiggle} ${hoverScale} transition-transform duration-200`}
          data-testid="tutor-persona-avatar"
          style={{ background: 'transparent', border: 'none', padding: 0, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.35))' }}
        >
          {previousSlug && (
            <img
              key={`prev-${previousSlug}`}
              src={`/tutor/${previousSlug}.png`}
              alt=""
              aria-hidden="true"
              className={`absolute inset-0 ${sizeCfg.img} object-contain rounded-full vv-avatar-fade vv-avatar-fade-out`}
              draggable={false}
            />
          )}
          <img
            key={`cur-${activeSlug}`}
            src={`/tutor/${activeSlug}.png`}
            alt={`${TUTOR_NAME}, ${activeSlug.replace('pari_', '').replace('_', ' ')}`}
            className={`relative ${sizeCfg.img} object-contain rounded-full vv-avatar-fade vv-avatar-fade-in ${animClass}`}
            draggable={false}
          />
        </button>

        {showBubble && (
          <div
            className={`relative ${sizeCfg.bubbleMax} ${size === 'fullscreen' ? 'mt-2' : 'mb-2'}`}
            data-testid="tutor-persona-bubble"
            onClick={completeTypewriter}
            role="status"
            aria-live="polite"
          >
            <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] px-4 py-3 shadow-lg backdrop-blur-md">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-faint)] mb-1 flex items-center gap-2">
                <span>{TUTOR_NAME}</span>
                {bubbleDismissable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setBubbleDismissed(true); }}
                    className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text)] -mr-1"
                    aria-label="Dismiss tutor message"
                    data-testid="tutor-bubble-dismiss"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="text-sm text-[var(--color-text)] font-bricolage leading-snug">
                {displayedMessage}
                {!reducedMotion && displayedMessage.length < (message?.length || 0) && (
                  <span className="inline-block w-1.5 h-3 ml-0.5 bg-[var(--color-accent)] vv-avatar-caret" />
                )}
              </div>
            </div>
            {/* Speech-bubble tail */}
            {size !== 'fullscreen' && (
              <div className="absolute -left-2 bottom-4 w-3 h-3 rotate-45 bg-[var(--color-bg-card)] border-l border-b border-[var(--color-border)]" aria-hidden="true" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
