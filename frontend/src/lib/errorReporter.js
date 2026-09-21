/**
 * Global client-side error reporter.
 *
 * Hooks into `window.error` and `window.unhandledrejection`, computes a stable
 * signature (message + first stack frame), throttles duplicate reports to
 * one per 5s per session, and fires-and-forgets a POST to /api/errors/report.
 *
 * Never allowed to throw itself, the reporter cannot become an error source.
 */
import { supabase } from './supabase';
import { isChunkLoadError } from '@/utils/lazyWithRetry';

const API = process.env.REACT_APP_BACKEND_URL;
const RECENT = new Map();           // signature → last-sent-timestamp
const THROTTLE_MS = 5000;

// Known-noise patterns, these are browser bugs or self-healed failures that
// carry no actionable signal for us. Filtering here keeps the admin errors
// tab focused on real issues.
const NOISE_PATTERNS = [
  // Cross-origin script error: the browser strips message/stack for security,
  // leaving us with just "Script error.", no way to fix, pure noise.
  /^Script error\.?$/i,
  // Safari iOS autofill leaks its internal callback name onto window before
  // it's defined. Known WebKit bug (bugs.webkit.org #… tracked upstream).
  /_AutofillCallbackHandler/i,
  // Passive-listener spam from browsers, framework internals, etc.
  /^ResizeObserver/i,
  // Chunk-load failures, handled by lazyWithRetry + ErrorBoundary via a
  // one-shot hard reload. Reporting adds noise; the fix is deploy-driven.
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
];

function isNoise(message, stack) {
  const msg = String(message || '');
  if (NOISE_PATTERNS.some((re) => re.test(msg))) return true;
  if (/chrome-extension:|moz-extension:|safari-extension:/i.test(stack || '')) return true;
  return false;
}

async function hashSignature(message, frame) {
  // Cheap non-crypto hash, plenty for a group key
  const s = `${message || ''}||${frame || ''}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${(message || 'unknown').slice(0, 40).replace(/\s+/g, '_')}_${(h >>> 0).toString(36)}`;
}

function firstStackFrame(stack) {
  if (!stack || typeof stack !== 'string') return '';
  const lines = stack.split('\n').map((l) => l.trim()).filter(Boolean);
  // Skip the first line which is usually the message itself.
  for (const line of lines.slice(1)) {
    if (line.startsWith('at ')) return line.slice(0, 200);
  }
  return lines[1] || '';
}

async function currentUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch { return null; }
}

async function send(payload) {
  try {
    // fetch with keepalive so navigations don't kill the report
    await fetch(`${API}/api/errors/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    /* swallow, reporter must never crash the app */
  }
}

export async function reportError({ message, stack, type = 'runtime', user_description = null }) {
  try {
    if (!message) return;
    // User-driven reports always pass through, even if the message would
    // otherwise be considered noise, the user *intent* to report is signal.
    if (!user_description && isNoise(message, stack)) return;
    const frame = firstStackFrame(stack);
    const signature = await hashSignature(message, frame);
    const now = Date.now();
    const prev = RECENT.get(signature);
    // User-driven reports (with a description) bypass throttling, the user
    // actively wants the report to land, and each report may carry new colour.
    if (!user_description && prev && now - prev < THROTTLE_MS) return;
    RECENT.set(signature, now);
    const user_id = await currentUserId();
    await send({
      signature,
      error_message: String(message).slice(0, 4000),
      error_stack: (stack || '').slice(0, 16000) || null,
      error_type: type,
      url: window.location?.href?.slice(0, 2048) || null,
      user_agent: (navigator.userAgent || '').slice(0, 512),
      user_id,
      user_description: user_description ? String(user_description).slice(0, 2000) : null,
    });
  } catch {
    /* never throw */
  }
}

let installed = false;
export function installErrorReporter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (ev) => {
    reportError({
      message: ev?.message || (ev?.error && ev.error.message) || 'error',
      stack: ev?.error && ev.error.stack,
      type: 'runtime',
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev?.reason;
    const message =
      (reason && (reason.message || reason.toString())) ||
      (typeof reason === 'string' ? reason : 'unhandled promise rejection');
    reportError({
      message,
      stack: reason && reason.stack,
      type: 'promise',
    });
  });
}
