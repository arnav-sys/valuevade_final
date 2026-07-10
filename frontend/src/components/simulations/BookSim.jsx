/**
 * BookSim — MVP 2.0 renderer for `sim_type='book'` simulations.
 *
 * Shape (config):
 *   {
 *     title: "The Balance Sheet",
 *     summary: "Short intro",
 *     chapters: [
 *       {
 *         title: "Chapter 1 — What a company owns",
 *         content: "Long-form markdown-ish text.",
 *         reflection: {
 *           prompt: "In 2-3 sentences, explain…",
 *           key_insights: ["...", "..."],
 *         },
 *         checkpoint: {
 *           question: "Which side of the balance sheet…?",
 *           options: ["Assets", "Liabilities", "Equity", "Revenue"],
 *           correct_index: 0,
 *           explanation: "Why the answer is correct.",
 *         }
 *       }
 *     ],
 *     final_reflection: "Wrap-up prompt for the student."
 *   }
 */
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, CheckCircle2, XCircle, Send, Loader2 } from 'lucide-react';

export default function BookSim({ config = {}, title, onProgress, onComplete }) {
  const chapters = Array.isArray(config.chapters) && config.chapters.length > 0
    ? config.chapters
    : [{ title: title || 'Chapter 1', content: config.summary || 'No chapters authored yet.', reflection: null, checkpoint: null }];

  const [chapterIdx, setChapterIdx] = useState(0);
  const [checkpointAnswers, setCheckpointAnswers] = useState({});
  const [reflectionAnswers, setReflectionAnswers] = useState({});
  const [finalReflection, setFinalReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const chapter = chapters[chapterIdx] || chapters[0];
  const total = chapters.length;
  const isLast = chapterIdx === total - 1;

  const stats = useMemo(() => {
    let correct = 0; let answered = 0;
    chapters.forEach((c, i) => {
      if (c.checkpoint) {
        if (checkpointAnswers[i] != null) {
          answered += 1;
          if (checkpointAnswers[i] === c.checkpoint.correct_index) correct += 1;
        }
      }
    });
    return { correct, answered, totalCheckpoints: chapters.filter((c) => c.checkpoint).length };
  }, [chapters, checkpointAnswers]);

  const handleCheckpointPick = (i, optionIdx) => {
    if (submitted) return;
    setCheckpointAnswers((p) => ({ ...p, [i]: optionIdx }));
    if (onProgress) {
      onProgress({ tasks_completed: stats.answered + 1, tasks_total: stats.totalCheckpoints || 1, accuracy: (stats.correct + (optionIdx === chapter.checkpoint?.correct_index ? 1 : 0)) / Math.max(stats.totalCheckpoints, 1) });
    }
  };

  const handleReflectionChange = (i, text) => {
    if (submitted) return;
    setReflectionAnswers((p) => ({ ...p, [i]: text }));
  };

  const goPrev = () => setChapterIdx((i) => Math.max(0, i - 1));
  const goNext = () => setChapterIdx((i) => Math.min(total - 1, i + 1));

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    const accuracy = stats.totalCheckpoints > 0 ? stats.correct / stats.totalCheckpoints : 1.0;
    setSubmitted(true);
    if (onComplete) await onComplete({ tasks_completed: stats.correct, tasks_total: stats.totalCheckpoints, accuracy });
    setSaving(false);
  };

  return (
    <div className="space-y-4" data-testid="book-sim">
      {/* Header brief */}
      <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-accent-purple)]/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
              Chaptered Read-Through · {chapterIdx + 1} / {total}
            </div>
            <h3 className="font-clash text-base text-[var(--color-text)] font-bold mb-1" data-testid="book-sim-title">
              {config.title || title || 'Book Simulation'}
            </h3>
            {config.summary && (
              <p className="text-sm text-[var(--color-text)] font-bricolage leading-relaxed">{config.summary}</p>
            )}
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2" data-testid="book-sim-progress">
        {chapters.map((c, i) => {
          const answered = c.checkpoint ? checkpointAnswers[i] != null : true;
          const isCurrent = i === chapterIdx;
          return (
            <button
              key={i}
              onClick={() => setChapterIdx(i)}
              className={`h-2 rounded-full transition-all ${
                isCurrent ? 'w-8 bg-[var(--color-primary)]' : answered ? 'w-4 bg-[var(--color-primary)]/50' : 'w-4 bg-[var(--color-border)]'
              }`}
              aria-label={`Chapter ${i + 1}`}
              data-testid={`book-sim-chapter-dot-${i}`}
            />
          );
        })}
      </div>

      {/* Chapter body */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-5 py-5" data-testid={`book-sim-chapter-${chapterIdx}`}>
        <h4 className="font-clash text-lg font-bold text-[var(--color-text)] mb-3" data-testid="book-sim-chapter-title">
          {chapter.title}
        </h4>
        <div className="prose prose-sm max-w-none text-[var(--color-text)] font-bricolage leading-relaxed whitespace-pre-line" data-testid="book-sim-chapter-content">
          {chapter.content || '—'}
        </div>

        {/* Reflection prompt */}
        {chapter.reflection?.prompt && (
          <div className="mt-5 p-4 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20" data-testid="book-sim-reflection">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-primary)] mb-2">Reflection</div>
            <p className="text-sm text-[var(--color-text)] font-bricolage mb-3">{chapter.reflection.prompt}</p>
            <textarea
              value={reflectionAnswers[chapterIdx] || ''}
              onChange={(e) => handleReflectionChange(chapterIdx, e.target.value)}
              disabled={submitted}
              rows={3}
              placeholder="Type your reflection…"
              className="w-full px-3 py-2 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bricolage outline-none focus:border-[var(--color-primary)] resize-none"
              data-testid={`book-sim-reflection-input-${chapterIdx}`}
            />
            {submitted && Array.isArray(chapter.reflection.key_insights) && chapter.reflection.key_insights.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-primary)]/20">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Key insights</div>
                <ul className="list-disc list-inside text-sm text-[var(--color-text-muted)] font-bricolage space-y-1">
                  {chapter.reflection.key_insights.map((k, ki) => <li key={ki}>{k}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Checkpoint MCQ */}
        {chapter.checkpoint?.question && (
          <div className="mt-5 p-4 rounded-lg bg-[var(--color-accent-purple)]/5 border border-[var(--color-accent-purple)]/20" data-testid="book-sim-checkpoint">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent-purple)] mb-2">Checkpoint</div>
            <p className="text-sm text-[var(--color-text)] font-bricolage font-semibold mb-3">{chapter.checkpoint.question}</p>
            <div className="space-y-2">
              {(chapter.checkpoint.options || []).map((opt, oi) => {
                const chosen = checkpointAnswers[chapterIdx] === oi;
                const isCorrect = oi === chapter.checkpoint.correct_index;
                const showResult = submitted || checkpointAnswers[chapterIdx] != null;
                return (
                  <button
                    key={oi}
                    onClick={() => handleCheckpointPick(chapterIdx, oi)}
                    disabled={submitted || checkpointAnswers[chapterIdx] != null}
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm font-bricolage transition-all ${
                      chosen && isCorrect ? 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]'
                        : chosen && !isCorrect ? 'border-[var(--color-error)] bg-[var(--color-error)]/10 text-[var(--color-error)]'
                        : showResult && isCorrect ? 'border-[var(--color-success)]/50 bg-[var(--color-success)]/5 text-[var(--color-success)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40 text-[var(--color-text)]'
                    }`}
                    data-testid={`book-sim-option-${chapterIdx}-${oi}`}
                  >
                    <span className="mr-2 font-mono">{String.fromCharCode(65 + oi)}.</span>
                    {opt}
                    {chosen && isCorrect && <CheckCircle2 size={14} className="inline ml-2" />}
                    {chosen && !isCorrect && <XCircle size={14} className="inline ml-2" />}
                  </button>
                );
              })}
            </div>
            {checkpointAnswers[chapterIdx] != null && chapter.checkpoint.explanation && (
              <div className="mt-3 pt-3 border-t border-[var(--color-accent-purple)]/20 text-sm text-[var(--color-text-muted)] font-bricolage">
                <span className="font-semibold text-[var(--color-text)]">Why:</span> {chapter.checkpoint.explanation}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={chapterIdx === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-bricolage text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="book-sim-prev-btn"
        >
          <ChevronLeft size={12} /> Previous
        </button>
        <div className="text-[10px] font-mono text-[var(--color-text-faint)]" data-testid="book-sim-progress-text">
          Chapter {chapterIdx + 1} of {total} · {stats.correct}/{stats.totalCheckpoints || 0} checkpoints correct
        </div>
        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            className="px-3 py-1.5 rounded-lg text-xs font-bricolage text-white bg-[var(--color-primary)] hover:brightness-110 transition-all flex items-center gap-1.5"
            data-testid="book-sim-next-btn"
          >
            Next <ChevronRight size={12} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitted || saving}
            className="px-4 py-1.5 rounded-lg text-xs font-bricolage text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] hover:brightness-110 transition-all flex items-center gap-1.5 disabled:opacity-60"
            data-testid="book-sim-submit-btn"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {submitted ? 'Submitted' : 'Complete'}
          </button>
        )}
      </div>

      {/* Final reflection on last chapter */}
      {isLast && config.final_reflection && (
        <div className="p-4 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 mt-2" data-testid="book-sim-final-reflection">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-primary)] mb-2">Final Reflection</div>
          <p className="text-sm text-[var(--color-text)] font-bricolage mb-3">{config.final_reflection}</p>
          <textarea
            value={finalReflection}
            onChange={(e) => setFinalReflection(e.target.value)}
            disabled={submitted}
            rows={4}
            placeholder="Take a moment to synthesise what you've learned…"
            className="w-full px-3 py-2 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bricolage outline-none focus:border-[var(--color-primary)] resize-none"
            data-testid="book-sim-final-reflection-input"
          />
        </div>
      )}
    </div>
  );
}
