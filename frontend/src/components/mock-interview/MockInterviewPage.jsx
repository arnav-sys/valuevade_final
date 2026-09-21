import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Sidebar from '../Sidebar';
import { Mic, MicOff, Send, Keyboard, ArrowRight, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

async function authedFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${session?.access_token || ''}`,
      ...(opts.body && !opts.headers?.['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

// Web Speech API hook, returns { supported, isRecording, transcript, start, stop, reset }
function useSpeechRecognition() {
  const recRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.lang = 'en-IN';
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    r.onresult = (ev) => {
      let final = '';
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      setTranscript((prev) => (final ? prev + final : prev) + (interim ? ` ${interim}` : ''));
    };
    r.onend = () => setIsRecording(false);
    r.onerror = () => setIsRecording(false);
    recRef.current = r;
  }, []);

  const start = useCallback(() => {
    if (!recRef.current) return;
    setTranscript('');
    try { recRef.current.start(); setIsRecording(true); } catch { /* already started */ }
  }, []);
  const stop = useCallback(() => {
    if (!recRef.current) return;
    try { recRef.current.stop(); } catch { /* */ }
    setIsRecording(false);
  }, []);
  const reset = useCallback(() => setTranscript(''), []);

  return { supported, isRecording, transcript, setTranscript, start, stop, reset };
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 items-center" data-testid="typing-indicator">
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{animationDelay:'0ms'}}/>
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{animationDelay:'150ms'}}/>
      <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{animationDelay:'300ms'}}/>
      <span className="text-xs text-[var(--color-text-muted)] ml-2">Interviewer is thinking…</span>
    </div>
  );
}

const ROUND_LABEL = { 1: 'Technical', 2: 'Behavioral', 3: 'Fit' };

export default function MockInterviewPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [iv, setIv] = useState(null);
  const [turns, setTurns] = useState([]);
  const [currentQ, setCurrentQ] = useState('');
  const [round, setRound] = useState(1);
  const [inputMode, setInputMode] = useState('voice');
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const [error, setError] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const speech = useSpeechRecognition();
  const turnsEnd = useRef(null);

  // Load existing or start new
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (routeId) {
        const r = await authedFetch(`/api/mock-interview/${routeId}`);
        if (!r.ok) { setError(`Could not load interview: ${r.status}`); return; }
        const d = await r.json();
        if (!mounted) return;
        setIv(d.interview);
        setTurns(d.turns);
        setRound(d.interview.current_round);
        // last interviewer turn = current question
        const lastInt = [...d.turns].reverse().find(t => t.role === 'interviewer');
        setCurrentQ(lastInt?.content || '');
        if (d.interview.status === 'completed') {
          navigate(`/mock-interview/${routeId}/results`, { replace: true });
        }
        return;
      }
      // Check eligibility before start
      const er = await authedFetch('/api/mock-interview/eligible');
      const ed = await er.json();
      if (!ed.eligible) { setEligibility(ed); return; }
      // start
      const sr = await authedFetch('/api/mock-interview/start', { method: 'POST' });
      if (!sr.ok) { setError(`Could not start: ${sr.status}`); return; }
      const sd = await sr.json();
      if (!mounted) return;
      navigate(`/mock-interview/${sd.interview_id}`, { replace: true });
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line
  }, [routeId, user]);

  useEffect(() => { turnsEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, currentQ]);

  const submitAnswer = async () => {
    const body = inputMode === 'voice' ? (speech.transcript || text).trim() : text.trim();
    if (!body || !iv) return;
    setThinking(true);
    setTurns(prev => [...prev, { role: 'candidate', content: body, round, turn_idx: (prev.length) }]);
    setText(''); speech.reset();
    try {
      const r = await authedFetch(`/api/mock-interview/${iv.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ content: body, input_method: inputMode, round }),
      });
      const d = await r.json();
      if (d.round_complete) {
        setRoundComplete(true);
        setCurrentQ(d.round_end_message);
        setTurns(prev => [...prev, { role: 'interviewer', content: d.round_end_message, round, turn_idx: prev.length }]);
      } else {
        setCurrentQ(d.next_question);
        setTurns(prev => [...prev, { role: 'interviewer', content: d.next_question, round, turn_idx: prev.length }]);
      }
    } catch (e) {
      setError(`Failed to submit: ${e.message}`);
    } finally {
      setThinking(false);
    }
  };

  const advanceRound = async () => {
    if (!iv) return;
    if (round === 3) {
      setThinking(true);
      const r = await authedFetch(`/api/mock-interview/${iv.id}/finalize`, { method: 'POST' });
      setThinking(false);
      if (r.ok) navigate(`/mock-interview/${iv.id}/results`);
      return;
    }
    setThinking(true);
    const r = await authedFetch(`/api/mock-interview/${iv.id}/next-round`, { method: 'POST' });
    setThinking(false);
    if (!r.ok) return;
    const d = await r.json();
    setRound(d.round);
    setCurrentQ(d.first_question);
    setTurns(prev => [...prev, { role: 'interviewer', content: d.opener, round: d.round, turn_idx: prev.length }]);
    setRoundComplete(false);
  };

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]" data-testid="mi-not-eligible">
            <h1 className="text-2xl font-bold mb-4 text-[var(--color-text)]">Mock Interview locked</h1>
            <p className="text-[var(--color-text-muted)] mb-3">
              {eligibility.reason === 'm14_project_pending' && 'Complete the M14 Interview Preparation module project to unlock the mock interview.'}
              {eligibility.reason === 'weekly_limit' && 'You\'ve already completed 3 mock interviews in the last 7 days. Come back next week, quality over quantity!'}
            </p>
            <Link to="/dashboard" className="text-[var(--color-accent)] hover:underline">← Back to dashboard</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-3xl mx-auto" data-testid="mock-interview-page">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Capstone</p>
            <h1 className="text-3xl font-bold text-[var(--color-text)] font-bricolage">Mock Equity Research Interview</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Round <strong data-testid="mi-round-num">{round}</strong> of 3 · <strong>{ROUND_LABEL[round]}</strong>
            </p>
          </div>

          {/* Conversation */}
          <div className="space-y-4 mb-6">
            {turns.map((t, i) => (
              <div key={i} className={`p-4 rounded-2xl ${t.role === 'interviewer'
                ? 'bg-[var(--color-bg-card)] border border-[var(--color-border)]'
                : 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 ml-12'}`}>
                <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {t.role === 'interviewer' ? 'Interviewer' : 'You'}
                </p>
                <p className="text-[var(--color-text)] whitespace-pre-wrap">{t.content}</p>
              </div>
            ))}
            {thinking && <div className="p-4"><TypingIndicator /></div>}
            <div ref={turnsEnd} />
          </div>

          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-500 mb-4">{error}</div>}

          {/* Round transition */}
          {roundComplete && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-bg-card)] border border-[var(--color-accent)]/40 text-center mb-6" data-testid="round-transition">
              <p className="text-lg font-medium text-[var(--color-text)] mb-3">Round {round} complete.</p>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                {round === 3 ? 'Finalizing your interview…' : 'Take a breath. When you\'re ready:'}
              </p>
              <button onClick={advanceRound} disabled={thinking}
                data-testid="mi-advance-round"
                className="px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg font-medium inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50">
                {thinking ? <Loader2 className="w-4 h-4 animate-spin"/> : <ArrowRight className="w-4 h-4" />}
                {round === 3 ? 'See My Results' : `Continue to Round ${round + 1}`}
              </button>
            </div>
          )}

          {/* Input panel */}
          {!roundComplete && (
            <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5" data-testid="mi-input-panel">
              <div className="flex gap-2 mb-4">
                {speech.supported && (
                  <button onClick={() => setInputMode('voice')}
                    data-testid="mi-mode-voice"
                    className={`px-3 py-2 rounded text-sm flex items-center gap-1 ${inputMode === 'voice' ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)]'}`}>
                    <Mic className="w-4 h-4" /> Voice
                  </button>
                )}
                <button onClick={() => setInputMode('text')}
                  data-testid="mi-mode-text"
                  className={`px-3 py-2 rounded text-sm flex items-center gap-1 ${inputMode === 'text' ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)]'}`}>
                  <Keyboard className="w-4 h-4" /> Type
                </button>
                {!speech.supported && <span className="ml-2 text-xs text-[var(--color-text-muted)] self-center">(voice unsupported in this browser)</span>}
              </div>

              {inputMode === 'voice' && speech.supported && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <button onClick={speech.isRecording ? speech.stop : speech.start}
                    data-testid="mi-mic-button"
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${speech.isRecording
                      ? 'bg-red-500 text-white animate-pulse scale-110'
                      : 'bg-[var(--color-accent)] text-white hover:scale-105'}`}>
                    {speech.isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                  </button>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {speech.isRecording ? 'Listening… press to stop' : 'Press to start speaking'}
                  </p>
                  {speech.transcript && (
                    <textarea value={speech.transcript} onChange={e => speech.setTranscript(e.target.value)}
                      data-testid="mi-voice-transcript"
                      className="w-full mt-2 p-3 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-sm min-h-[100px]"
                      placeholder="Your spoken answer appears here. Edit before submitting if needed." />
                  )}
                </div>
              )}

              {inputMode === 'text' && (
                <textarea value={text} onChange={e => setText(e.target.value)}
                  data-testid="mi-text-input"
                  placeholder="Type your answer here…"
                  className="w-full p-3 rounded-lg bg-[var(--color-bg-card-hover)] border border-[var(--color-border)] text-sm min-h-[140px]" />
              )}

              <div className="flex justify-end mt-4">
                <button onClick={submitAnswer}
                  disabled={thinking || !(inputMode === 'voice' ? speech.transcript.trim() : text.trim())}
                  data-testid="mi-submit"
                  className="px-5 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium inline-flex items-center gap-2 disabled:opacity-40">
                  {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Answer
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
