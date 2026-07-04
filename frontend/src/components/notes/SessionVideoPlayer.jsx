// SessionVideoPlayer — HTML5 <video> with a speed-control overlay.
// Rendered at the top of NotesPage when a session has a lecture_url.
//
// Behaviour:
//   • Standard native <video controls> for scrub / play-pause / fullscreen.
//   • Speed overlay: 0.75x · 1x · 1.25x · 1.5x · 1.75x · 2x buttons.
//   • Last-chosen speed persists across sessions via localStorage
//     (`valuevade_video_speed`).
//   • Applies the persisted speed as soon as metadata loads (native <video>
//     resets playbackRate on src changes, so we re-apply on `loadedmetadata`).
//   • Dark-themed glassmorphic wrapper with a violet accent border.
import { useEffect, useRef, useState } from 'react';
import { Gauge } from 'lucide-react';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const STORAGE_KEY = 'valuevade_video_speed';

function readStoredSpeed() {
  try {
    const v = parseFloat(localStorage.getItem(STORAGE_KEY) || '1');
    return SPEEDS.includes(v) ? v : 1;
  } catch { return 1; }
}

export default function SessionVideoPlayer({ src, title }) {
  const videoRef = useRef(null);
  const [speed, setSpeed] = useState(readStoredSpeed);

  // Apply speed on mount + whenever it changes (metadata load also re-applies
  // below, since Chromium resets rate when src changes).
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
    try { localStorage.setItem(STORAGE_KEY, String(speed)); } catch { /* quota */ }
  }, [speed]);

  // Re-apply the persisted rate when native <video> finishes loading metadata,
  // which is the point Chromium/Firefox reliably respect the property.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const apply = () => { v.playbackRate = speed; };
    v.addEventListener('loadedmetadata', apply);
    return () => v.removeEventListener('loadedmetadata', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!src) return null;

  return (
    <div
      className="mb-6 rounded-2xl overflow-hidden border border-[var(--color-primary)]/40 bg-black/60 backdrop-blur-md shadow-[0_10px_40px_-15px_var(--color-primary)]"
      data-testid="session-video-player"
    >
      <div className="relative">
        <video
          ref={videoRef}
          src={src}
          controls
          preload="metadata"
          className="w-full aspect-video block bg-black"
          data-testid="session-video-element"
        >
          Your browser doesn&apos;t support HTML5 video.
        </video>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[var(--color-primary)]/10 via-transparent to-transparent border-t border-[var(--color-primary)]/25">
        <Gauge size={13} className="text-[var(--color-primary)] shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mr-1 shrink-0">
          Speed
        </span>
        <div className="flex flex-wrap gap-1" data-testid="video-speed-buttons">
          {SPEEDS.map((s) => {
            const active = s === speed;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={
                  'px-2 py-0.5 rounded-md text-[11px] font-mono transition-all border ' +
                  (active
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-[0_0_12px_-2px_var(--color-primary)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40')
                }
                aria-pressed={active}
                data-testid={`video-speed-${String(s).replace('.', '_')}x`}
              >
                {s === 1 ? '1x' : `${s}x`}
              </button>
            );
          })}
        </div>
        {title && (
          <span className="ml-auto hidden sm:block text-[10px] font-mono text-[var(--color-text-faint)] truncate max-w-[280px]">
            {title}
          </span>
        )}
      </div>
    </div>
  );
}
