import { useState, useCallback } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import useVoiceRecorder from '../utils/useVoiceRecorder';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

function formatElapsed(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Microphone button + UI for recording the user's spoken answer to an
 * interview question. On stop, the audio blob is uploaded to
 * /api/voice/transcribe (Whisper). The returned text is APPENDED to the
 * caller's answer (so users can record multiple takes or mix typing+voice).
 *
 * Props:
 *   onTranscribed(text: string)   required. Called with the transcribed text.
 *   disabled?: boolean            disable the entire control (e.g. while evaluating)
 *   prompt?: string               optional context prompt to bias Whisper (e.g. the question)
 *   language?: string             ISO-639-1 (default 'en')
 */
export default function VoiceInputButton({ onTranscribed, disabled = false, prompt, language = 'en' }) {
  const { state, elapsed, error, start, stop, cancel, reset } = useVoiceRecorder();
  const [uploadError, setUploadError] = useState(null);

  const handleStart = useCallback(async () => {
    setUploadError(null);
    if (state === 'error') reset();
    await start();
  }, [start, state, reset]);

  const handleStop = useCallback(async () => {
    setUploadError(null);
    const blob = await stop();
    if (!blob || blob.size === 0) {
      setUploadError('Nothing was recorded. Please try again.');
      reset();
      return;
    }
    // Detect extension from MIME for the backend's filename hint
    const mime = blob.type || 'audio/webm';
    let ext = 'webm';
    if (mime.includes('mp4')) ext = 'mp4';
    else if (mime.includes('ogg')) ext = 'ogg';
    else if (mime.includes('mpeg')) ext = 'mp3';
    const file = new File([blob], `answer.${ext}`, { type: mime });
    const fd = new FormData();
    fd.append('audio', file);
    fd.append('language', language);
    if (prompt) fd.append('prompt', prompt.slice(0, 1024));

    try {
      const res = await axios.post(`${API_BASE}/api/voice/transcribe`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      });
      const text = res?.data?.text;
      if (text && text.trim()) {
        onTranscribed(text.trim());
      } else {
        setUploadError("Couldn't hear anything in the recording. Speak a bit louder and try again.");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Transcription failed';
      setUploadError(msg);
    } finally {
      reset();
    }
  }, [stop, language, prompt, onTranscribed, reset]);

  const baseBtnCls =
    'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold font-bricolage transition-all disabled:opacity-40 disabled:cursor-not-allowed';

  const isIdle = state === 'idle';
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';

  return (
    <div className="flex flex-col items-end gap-1.5" data-testid="voice-input">
      <div className="flex items-center gap-2">
        {isIdle && (
          <button
            type="button"
            onClick={handleStart}
            disabled={disabled || isProcessing}
            className={`${baseBtnCls} h-9 px-3.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text)]`}
            aria-label="Record voice answer"
            data-testid="voice-record-start"
          >
            <Mic size={15} className="text-[var(--color-primary)]" />
            <span className="hidden sm:inline">Speak answer</span>
            <span className="sm:hidden">Speak</span>
          </button>
        )}

        {isRecording && (
          <>
            <span
              className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-xs font-mono"
              data-testid="voice-recording-indicator"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--color-danger)] animate-pulse" />
              REC {formatElapsed(elapsed)}
            </span>
            <button
              type="button"
              onClick={handleStop}
              className={`${baseBtnCls} h-9 px-3.5 bg-[var(--color-danger)] hover:brightness-110 text-white`}
              data-testid="voice-record-stop"
            >
              <Square size={13} fill="currentColor" />
              <span>Stop & transcribe</span>
            </button>
            <button
              type="button"
              onClick={cancel}
              className="h-9 px-2.5 rounded-xl text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              data-testid="voice-record-cancel"
            >
              Cancel
            </button>
          </>
        )}

        {isProcessing && (
          <span
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-xs font-mono"
            data-testid="voice-transcribing"
          >
            <Loader2 size={13} className="animate-spin" />
            Transcribing…
          </span>
        )}
      </div>

      {(error || uploadError) && (
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-danger)] max-w-xs text-right"
          data-testid="voice-error"
        >
          <AlertCircle size={12} />
          <span className="truncate">{error || uploadError}</span>
        </span>
      )}
    </div>
  );
}
