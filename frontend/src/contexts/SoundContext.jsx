import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';

// Sound system for gamification feedback.
//
// Rules:
//   1. Settings persisted in localStorage as `vv_sound_enabled` (default true).
//   2. NO sound plays until the user has interacted with the page at least
//      once (browser autoplay policy). Calls before that no-op silently.
//   3. Audio elements are preloaded once on provider mount so the first play
//      doesn't lag.
//   4. Designed to be extended with more slugs (badge_unlock, streak_milestone,
//      etc.) in later phases — just add to SOUND_SOURCES.

const SOUND_SOURCES = {
  xp_gain: '/sounds/xp_gain.wav',
  level_up: '/sounds/level_up.wav',
  streak_milestone: '/sounds/streak_milestone.wav',
  badge_unlock: '/sounds/badge_unlock.wav',
};

const STORAGE_KEY = 'vv_sound_enabled';

const SoundContext = createContext(null);

export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return true;
    return v === 'true';
  });
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const audiosRef = useRef({});

  // Preload audio elements once
  useEffect(() => {
    Object.entries(SOUND_SOURCES).forEach(([slug, src]) => {
      try {
        const a = new Audio(src);
        a.preload = 'auto';
        a.volume = slug === 'level_up' ? 0.5 : 0.35;
        audiosRef.current[slug] = a;
      } catch {
        // Audio API not available — playSound will silently no-op.
      }
    });
  }, []);

  // Track first user gesture
  useEffect(() => {
    if (userHasInteracted) return;
    const flip = () => setUserHasInteracted(true);
    const opts = { once: true, capture: true };
    window.addEventListener('pointerdown', flip, opts);
    window.addEventListener('keydown', flip, opts);
    window.addEventListener('touchstart', flip, opts);
    return () => {
      window.removeEventListener('pointerdown', flip, opts);
      window.removeEventListener('keydown', flip, opts);
      window.removeEventListener('touchstart', flip, opts);
    };
  }, [userHasInteracted]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* private mode */ }
  }, [enabled]);

  const playSound = useCallback((slug, opts = {}) => {
    // `force=true` plays even when sound is disabled — used by the Settings
    // toggle to preview the sound immediately after enabling it (the new
    // enabled state hasn't flushed into our callback's closure yet).
    if (!opts.force && !enabled) return;
    if (!userHasInteracted) return;
    const a = audiosRef.current[slug];
    if (!a) return;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay still blocked */ });
    } catch { /* ignore */ }
  }, [enabled, userHasInteracted]);

  const toggleEnabled = useCallback(() => setEnabled((v) => !v), []);

  const value = useMemo(() => ({
    enabled,
    setEnabled,
    toggleEnabled,
    playSound,
    userHasInteracted,
  }), [enabled, toggleEnabled, playSound, userHasInteracted]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    // Outside a provider (e.g. tests) — degrade gracefully.
    return { enabled: true, setEnabled: () => {}, toggleEnabled: () => {}, playSound: () => {}, userHasInteracted: false };
  }
  return ctx;
}
