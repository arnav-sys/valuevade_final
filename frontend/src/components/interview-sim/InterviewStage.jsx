import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, ArrowRight, CheckCircle2, Users, Brain, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { interviewSimFetch } from '../../utils/interviewSim';
import useInterviewerVoice from '../../utils/useInterviewerVoice';
import VoiceInputButton from '../VoiceInputButton';
import { SimpleMarkdown } from './simShared';
import { toast } from 'sonner';

/** Shared player for the behavioural (HR) and technical rounds — voice-first. */
export default function InterviewStage({ stage, attempt, sim, onAdvance }) {
  const isHR = stage === 'behavioural';
  const existing = attempt.stage_data?.[stage];
  const [turns, setTurns] = useState(existing?.turns || []);
  const [numQuestions, setNumQuestions] = useState(sim.process_meta?.[stage]?.num_questions || 5);
  const [draft, setDraft] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [roundResult, setRoundResult] = useState(existing?.completed_at ? existing : null);
  const [began, setBegan] = useState((existing?.turns || []).length > 0);
  const [voiceOn, setVoiceOn] = useState(true);
  const endRef = useRef(null);

  // Auto-narrate every new interviewer turn with Pari's voice (nova).
  const { speaking, loading: voiceLoading, replay, stop: stopVoice, error: voiceError } =
    useInterviewerVoice(turns, { voice: 'nova', autoPlay: voiceOn, enabled: voiceOn });

  useEffect(() => {
    let alive = true;
    if (!began && !roundResult) {
      setThinking(true);
      interviewSimFetch(`/api/interview-sim/attempt/${attempt.id}/interview/begin`, {
        method: 'POST',
        body: JSON.stringify({ stage }),
      })
        .then((r) => {
          if (!alive) return;
          setTurns(r.turns || []);
          if (r.num_questions) setNumQuestions(r.num_questions);
          setBegan(true);
        })
        .catch((e) => toast.error(e.message))
        .finally(() => alive && setThinking(false));
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns, thinking]);

  const answered = turns.filter((t) => t.role === 'candidate').length;

  const submit = async () => {
    const answer = draft.trim();
    if (!answer || thinking) return;
    setThinking(true);
    setTurns((p) => [...p, { role: 'candidate', content: answer }]);
    setDraft('');
    const method = usedVoice ? 'voice' : 'text';
    setUsedVoice(false);
    try {
      const r = await interviewSimFetch(`/api/interview-sim/attempt/${attempt.id}/interview/answer`, {
        method: 'POST',
        body: JSON.stringify({ stage, answer, input_method: method }),
      });
      if (r.round_complete) {
        setTurns((p) => [...p, { role: 'interviewer', content: r.closing }]);
        setRoundResult(r.result);
      } else {
        setTurns((p) => [...p, { role: 'interviewer', content: r.next_question }]);
      }
    } catch (e) {
      toast.error(e.message);
      setTurns((p) => p.slice(0, -1));
      setDraft(answer);
    } finally {
      setThinking(false);
    }
  };

  const StageIcon = isHR ? Users : Brain;

  return (
    <div className="space-y-4" data-testid={`interview-stage-${stage}`}>
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-purple)]/15 border border-[var(--color-accent-purple)]/30 text-[var(--color-accent-purple)] flex items-center justify-center">
            <StageIcon size={16} />
          </div>
          <div>
            <h2 className="font-clash text-base font-bold text-[var(--color-text)]">
              {isHR ? 'HR / Behavioural Round' : 'Technical Round'}
            </h2>
            <p className="text-[10px] font-mono text-[var(--color-text-muted)]">
              Answer by voice for the real-interview feel — or type if you prefer
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0" data-testid="interview-progress">
          {Math.min(answered, numQuestions)}/{numQuestions} answered
        </span>
        <button
          type="button"
          onClick={() => { if (voiceOn) stopVoice(); setVoiceOn((v) => !v); }}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-wider transition-colors ${
            voiceOn
              ? 'border-[var(--color-accent-purple)]/40 bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface)]/50 text-[var(--color-text-muted)]'
          }`}
          title={voiceOn ? 'Turn off Pari\'s voice' : 'Turn on Pari\'s voice'}
          data-testid="interview-voice-toggle"
        >
          {voiceOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
          Pari&apos;s voice
        </button>
      </div>

      {/* Transcript */}
      <div className="space-y-3" data-testid="interview-transcript">
        {turns.map((t, i) => {
          const lastInterviewerIdx = (() => {
            for (let k = turns.length - 1; k >= 0; k--) {
              if (turns[k].role === 'interviewer') return k;
            }
            return -1;
          })();
          const isLastQuestion = t.role === 'interviewer' && i === lastInterviewerIdx;
          return (
            <div
              key={i}
              className={`p-4 rounded-2xl ${t.role === 'interviewer'
                ? 'glass-card'
                : 'bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/25 ml-6 sm:ml-12'}`}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                  {t.role === 'interviewer' ? `${sim.firm_name} Interviewer` : 'You'}
                  {t.role === 'interviewer' && isLastQuestion && speaking && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[var(--color-accent-purple)] normal-case tracking-normal">
                      <span className="w-1 h-1 bg-[var(--color-accent-purple)] rounded-full animate-pulse" />
                      Pari speaking…
                    </span>
                  )}
                </p>
                {t.role === 'interviewer' && isLastQuestion && voiceOn && (
                  <button
                    type="button"
                    onClick={replay}
                    disabled={voiceLoading}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-[var(--color-accent-purple)] hover:bg-[var(--color-accent-purple)]/10 disabled:opacity-50 shrink-0"
                    title="Replay question"
                    data-testid={`interview-replay-${i}`}
                  >
                    {voiceLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Replay
                  </button>
                )}
              </div>
              <p className="text-sm font-bricolage text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">{t.content}</p>
              {t.role === 'interviewer' && isLastQuestion && voiceError === 'autoplay-blocked' && voiceOn && (
                <p className="mt-2 text-[10px] font-mono text-amber-500">
                  Browser blocked auto-play — hit Replay to hear the question.
                </p>
              )}
            </div>
          );
        })}
        {thinking && (
          <div className="p-4 flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)]" data-testid="interviewer-thinking">
            <Loader2 size={13} className="animate-spin" /> Interviewer is thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Round complete → feedback */}
      {roundResult && (
        <div className="glass-card rounded-2xl p-6" data-testid="interview-round-result">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/25 text-[var(--color-success)] text-[10px] font-mono uppercase tracking-[0.2em] mb-3">
            <CheckCircle2 size={12} /> Round complete
          </div>
          <h3 className="font-clash text-xl font-bold text-[var(--color-text)] mb-3" data-testid="interview-round-score">
            Round score: {Math.round(roundResult.score)}/100
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/5 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-success)] mb-1.5">Strengths</p>
              <ul className="text-xs font-bricolage text-[var(--color-text)] space-y-1">
                {(roundResult.strengths || []).map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-500 mb-1.5">Gaps</p>
              <ul className="text-xs font-bricolage text-[var(--color-text)] space-y-1">
                {(roundResult.gaps || []).map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          </div>
          {(roundResult.feedback_bullets || []).length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3 mb-5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent-purple)] mb-1.5">Coach&apos;s notes</p>
              <ul className="text-xs font-bricolage text-[var(--color-text)] space-y-1">
                {roundResult.feedback_bullets.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          )}
          <button
            onClick={onAdvance}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all"
            data-testid="interview-continue-btn"
          >
            {isHR ? 'Continue to Technical Interview' : 'Continue to Case Study'} <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Answer composer */}
      {!roundResult && began && (
        <div className="glass-card rounded-2xl p-5" data-testid="interview-composer">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Your answer</p>
            <VoiceInputButton
              disabled={thinking}
              prompt={turns.filter((t) => t.role === 'interviewer').slice(-1)[0]?.content}
              onTranscribed={(text) => {
                setDraft((p) => (p ? `${p} ${text}` : text));
                setUsedVoice(true);
              }}
            />
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Speak your answer with the mic above (it lands here for review), or type directly…"
            rows={4}
            maxLength={6000}
            className="w-full p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-bricolage text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none resize-y"
            data-testid="interview-answer-input"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={submit}
              disabled={thinking || !draft.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:brightness-110 transition-all disabled:opacity-40"
              data-testid="interview-submit-answer-btn"
            >
              {thinking ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
