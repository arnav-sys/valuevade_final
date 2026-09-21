import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Browser audio recording hook for capturing interview answers.
 *
 * Lifecycle:
 *   idle → recording → processing → idle  (success)
 *   idle → error → idle                    (mic denied / unsupported)
 *
 * Usage:
 *   const { state, elapsed, start, stop, cancel, error } = useVoiceRecorder();
 *   start() returns when recording has actually begun (mic permission granted)
 *   stop() returns the recorded Blob (audio/webm by default)
 *
 * Notes:
 *   - Picks the best supported MIME type for MediaRecorder (Safari prefers mp4)
 *   - Auto-stops after MAX_DURATION_MS so the user doesn't accidentally leave
 *     a recording running indefinitely
 *   - Properly releases the mic stream on stop / cancel / unmount
 */

const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes, well under Whisper's 25MB

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export default function useVoiceRecorder() {
  const [state, setState] = useState('idle'); // idle | recording | processing | error
  const [elapsed, setElapsed] = useState(0); // seconds while recording
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const stopResolveRef = useRef(null);
  const autoStopTimeoutRef = useRef(null);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Microphone is not supported in this browser.');
      setState('error');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blobType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];
        cleanupStream();
        const resolver = stopResolveRef.current;
        stopResolveRef.current = null;
        if (resolver) resolver(blob);
      };
      recorder.onerror = (e) => {
        setError(e?.error?.message || 'Recording error');
        setState('error');
        cleanupStream();
      };

      // Time-slice every 1s so flush events happen and chunks accumulate.
      recorder.start(1000);
      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      autoStopTimeoutRef.current = setTimeout(() => {
        // Caller reads .state in their effect, they'll see 'processing' on next render
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, MAX_DURATION_MS);
      setState('recording');
      return true;
    } catch (err) {
      cleanupStream();
      let msg = err?.message || 'Microphone access denied';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        msg = 'Microphone access denied. Please allow microphone access in your browser and try again.';
      } else if (err?.name === 'NotFoundError') {
        msg = 'No microphone found. Please connect a microphone and try again.';
      }
      setError(msg);
      setState('error');
      return false;
    }
  }, [cleanupStream]);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }
      stopResolveRef.current = resolve;
      setState('processing');
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupStream();
        resolve(null);
      }
    });
  }, [cleanupStream]);

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      stopResolveRef.current = null;
      try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
    }
    chunksRef.current = [];
    cleanupStream();
    setState('idle');
    setElapsed(0);
  }, [cleanupStream]);

  const reset = useCallback(() => {
    setError(null);
    setState('idle');
    setElapsed(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch { /* noop */ }
      cleanupStream();
    };
  }, [cleanupStream]);

  return { state, elapsed, error, start, stop, cancel, reset };
}
