/**
 * useInterviewerVoice
 * -------------------
 * Auto-plays Pari's voice (OpenAI TTS "nova") for each new interviewer question
 * in the HR + Technical rounds. Exposes a Replay button too.
 *
 * Usage:
 *   const { speaking, replay, error } = useInterviewerVoice(turns);
 *
 * - `turns` is the transcript array. Every time a new `interviewer` turn is
 *   appended, its content is spoken exactly once. Base64 audio is cached
 *   per exact text on the backend so replays are free.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { interviewSimFetch } from './interviewSim';

/**
 * Convert a base64 mp3 to a playable object URL (small helper — the browser
 * plays base64 data URIs directly but object URLs are cleaner + garbage-safe).
 */
function b64ToObjectUrl(b64, mime = 'audio/mpeg') {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export default function useInterviewerVoice(turns, options = {}) {
  const { voice = 'nova', autoPlay = true, enabled = true } = options;
  const audioRef = useRef(null);
  const spokenIndexRef = useRef(-1); // highest turn index we've narrated
  const lastTextRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cleanup any prior playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text) => {
    if (!text || !enabled) return;
    stop();
    setLoading(true);
    setError(null);
    try {
      const r = await interviewSimFetch('/api/interview-sim/tts', {
        method: 'POST',
        body: JSON.stringify({ text, voice }),
      });
      const url = b64ToObjectUrl(r.audio_base64, r.mime || 'audio/mpeg');
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      setLoading(false);
      setSpeaking(true);
      try {
        await audio.play();
      } catch (playErr) {
        // Autoplay policy: modern browsers may block the first play() until
        // the user has interacted. Fall back to silent — the Replay button
        // becomes the escape hatch (user click satisfies the gesture rule).
        setSpeaking(false);
        setError(playErr?.name === 'NotAllowedError' ? 'autoplay-blocked' : null);
      }
    } catch (e) {
      setLoading(false);
      setSpeaking(false);
      setError(e?.message || 'tts failed');
    }
  }, [voice, enabled, stop]);

  // Auto-play whenever a new interviewer turn appears at the tail.
  useEffect(() => {
    if (!autoPlay || !enabled) return;
    const last = turns[turns.length - 1];
    if (!last || last.role !== 'interviewer') return;
    const idx = turns.length - 1;
    if (idx <= spokenIndexRef.current) return; // already narrated
    spokenIndexRef.current = idx;
    lastTextRef.current = last.content;
    speak(last.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, autoPlay, enabled]);

  const replay = useCallback(() => {
    // Prefer the last narrated line; otherwise the tail interviewer turn.
    const text = lastTextRef.current || (() => {
      for (let i = turns.length - 1; i >= 0; i--) {
        if (turns[i]?.role === 'interviewer') return turns[i].content;
      }
      return null;
    })();
    if (text) speak(text);
  }, [turns, speak]);

  // Stop any in-flight audio on unmount.
  useEffect(() => () => stop(), [stop]);

  return { speaking, loading, replay, stop, error };
}
