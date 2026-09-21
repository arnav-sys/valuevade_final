import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Persona constants, single source of truth. Renaming the tutor is a
// one-line change here.
export const TUTOR_NAME = 'Pari';
export const TUTOR_TITLE = 'Your AI Finance Tutor';

// LocalStorage flag so users can disable the persona from settings.
const LS_KEY = 'vv_tutor_enabled';

const TutorContext = createContext(null);

export function TutorProvider({ children }) {
  const [currentPose, setCurrentPose] = useState('idle');
  const [currentMessage, setCurrentMessage] = useState(null);
  const [enabled, setEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(LS_KEY);
    return stored === null ? true : stored === 'true';
  });

  // Persist user toggle across reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LS_KEY, enabled ? 'true' : 'false');
  }, [enabled]);

  const setTutor = useCallback((pose, message = null) => {
    if (pose) setCurrentPose(pose);
    setCurrentMessage(message);
  }, []);

  const clearTutor = useCallback(() => {
    setCurrentPose('idle');
    setCurrentMessage(null);
  }, []);

  const setEnabled = useCallback((next) => setEnabledState(!!next), []);

  const value = useMemo(() => ({
    currentPose,
    currentMessage,
    enabled,
    setEnabled,
    setTutor,
    clearTutor,
    TUTOR_NAME,
    TUTOR_TITLE,
  }), [currentPose, currentMessage, enabled, setEnabled, setTutor, clearTutor]);

  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}

export function useTutor() {
  const ctx = useContext(TutorContext);
  if (!ctx) {
    return {
      currentPose: 'idle',
      currentMessage: null,
      enabled: false,
      setEnabled: () => {},
      setTutor: () => {},
      clearTutor: () => {},
      TUTOR_NAME,
      TUTOR_TITLE,
    };
  }
  return ctx;
}

// Phase mapping, central registry of which pose maps to which phase/event.
// Pages import individual entries or call the helper with a phase key.
export const TUTOR_PHASES = {
  notes_intro: {
    pose: 'waving',
    message: (s) => `Let's dive into "${s?.session_title || 'this session'}". I'll walk you through it.`,
  },
  notes_card: {
    pose: 'explaining',
    message: (c) => c?.title || c?.heading || 'Stay with me here.',
  },
  quiz_intro: {
    pose: 'asking',
    message: () => 'Time to test what you learned. Take your time on each question.',
  },
  quiz_correct: {
    pose: 'encouraging',
    message: () => 'Nice work, you nailed it!',
  },
  quiz_wrong: {
    pose: 'listening',
    message: () => 'Not quite, but every mistake is a lesson. Try the next one.',
  },
  interview_intro: {
    pose: 'interviewer',
    message: () => "Let's do a quick interview. I'll ask, you answer, no pressure.",
  },
  simulation_intro: {
    pose: 'simulation_brief',
    message: () => "This simulation tests your judgement. Here's the brief.",
  },
  project_intro: {
    pose: 'simulation_brief',
    message: () => "Project time. Apply what you've learned, I'll be here if you need me.",
  },
  session_complete: {
    pose: 'celebrating',
    message: () => "Great session! You're making real progress.",
  },
  module_complete: {
    pose: 'celebrating',
    message: () => 'A whole module complete. Take a moment to feel that.',
  },
  capstone_complete: {
    pose: 'celebrating',
    message: () => 'You finished the capstone. This is real, hard-earned skill.',
  },
  dashboard_greeting: {
    pose: 'waving',
    message: (u) => `Welcome back, ${u?.first_name || u?.full_name?.split(' ')[0] || 'Analyst'}.`,
  },
  journey: {
    pose: 'idle',
    message: (s) => `${s?.completed || 0} module${(s?.completed || 0) === 1 ? '' : 's'} done. Keep going.`,
  },
  apology: {
    pose: 'apology',
    message: () => "I can only help with course material, try asking again in those terms.",
  },
  goodbye: {
    pose: 'goodbye',
    message: () => 'See you next time.',
  },
  idle: { pose: 'idle', message: null },
};

/**
 * Resolve a phase key + payload into { pose, message } the AvatarPersona
 * can consume. Returns null when the phase key is unknown.
 */
export function resolveTutorPhase(phaseKey, payload) {
  const cfg = TUTOR_PHASES[phaseKey];
  if (!cfg) return null;
  const message = typeof cfg.message === 'function' ? cfg.message(payload || {}) : cfg.message;
  return { pose: cfg.pose, message };
}
