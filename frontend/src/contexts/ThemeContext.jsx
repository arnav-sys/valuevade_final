import { createContext, useContext, useState, useEffect } from 'react';

/* ──────────────────────────────────────────────────────────────────────────
 * UNIFIED THEME CONTEXT
 * ──────────────────────────────────────────────────────────────────────────
 * Single source of truth for theme across the entire app:
 *   • Landing (`/`)
 *   • Auth-gated routes (Dashboard, Profile, Settings, Courses, Course
 *     Details, Capstones, etc.)
 *
 * Canonical key:    `valuevade_theme`   value: `"dark" | "light"`
 * Default:          `"dark"`            (first-time visitor lands in dark)
 *
 * v3 migration block (runs at MODULE-IMPORT time, strictly before any
 * useState initialiser fires) consolidates two legacy keys:
 *   • `vv-theme`                 (old ThemeContext key, auth-gated)
 *   • `valuevade_landing_theme`  (old LandingPage key, landing only)
 *
 * Source-of-truth precedence (when both legacy keys are present):
 *   1. Canonical `valuevade_theme` if already set
 *   2. `vv-theme` (most recent app-wide toggle)
 *   3. `valuevade_landing_theme` (last landing-only intent)
 *   4. default `"dark"`
 *
 * After v3 is stamped, normal persistence resumes and legacy keys are
 * wiped so only ONE key remains in localStorage. */

const STORAGE_KEY     = 'valuevade_theme';
const VERSION_KEY     = 'valuevade_theme_version';
const THEME_VERSION   = 'v3';
const LEGACY_KEYS     = ['vv-theme', 'valuevade_landing_theme'];
const DEFAULT_THEME   = 'dark';

/* Migration, synchronous, runs once on first script load. */
if (typeof window !== 'undefined') {
  try {
    const ls = window.localStorage;
    const stamped = ls.getItem(VERSION_KEY);
    if (stamped !== THEME_VERSION) {
      // Resolve a sensible value to migrate forward.
      let resolved = ls.getItem(STORAGE_KEY);
      if (resolved !== 'dark' && resolved !== 'light') {
        for (const key of LEGACY_KEYS) {
          const v = ls.getItem(key);
          if (v === 'dark' || v === 'light') { resolved = v; break; }
        }
      }
      if (resolved !== 'dark' && resolved !== 'light') resolved = DEFAULT_THEME;
      ls.setItem(STORAGE_KEY, resolved);
      // Sweep legacy keys so devtools shows only the canonical one.
      LEGACY_KEYS.forEach((k) => ls.removeItem(k));
      ls.setItem(VERSION_KEY, THEME_VERSION);
    }
  } catch { /* localStorage unavailable, fall through to runtime default */ }
}

function readInitialTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' ? 'light' : 'dark';
  } catch { return DEFAULT_THEME; }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else                  root.classList.remove('dark');
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
    // iOS Safari address-bar tint
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0A0F1C' : '#F6F8F7');
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
