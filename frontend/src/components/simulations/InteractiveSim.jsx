import { useMemo, useState, useRef, useEffect } from 'react';
import {
  DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor,
  useSensor, useSensors, closestCenter, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, XCircle, GripVertical, ArrowRight, RefreshCw, Target } from 'lucide-react';
import ModuleLab from './ModuleLab';

/* =============================================================
   EXERCISE 1: CATEGORIZE — drag items onto category drop zones
   ============================================================= */
function DraggableChip({ id, text, disabled }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card cursor-grab active:cursor-grabbing select-none ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-[var(--color-primary)]/40 hover:-translate-y-0.5'
      } transition-all`}
      data-testid={`interactive-drag-${id}`}
    >
      <GripVertical size={14} className="text-[var(--color-text-muted)]" />
      <span className="text-sm font-bricolage text-[var(--color-text)]">{text}</span>
    </div>
  );
}

function CategoryDropZone({ id, label, color, children, isOver }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="rounded-2xl p-4 min-h-[140px] border-2 border-dashed transition-all"
      style={{
        background: isOver ? `${color}15` : `${color}08`,
        borderColor: isOver ? `${color}80` : `${color}30`,
      }}
      data-testid={`interactive-category-${id}`}
    >
      <div
        className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3"
        style={{ color }}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function CategorizeExercise({ config, onComplete }) {
  const items = config?.items || [];
  const categories = config?.categories || [];
  const showExplanations = config?.show_explanations || 'after_all';

  // placements: { itemId: categoryId }
  const [placements, setPlacements] = useState({});
  const [checked, setChecked] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } })
  );

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    setOverId(null);
    if (!over) return;
    if (over.id === 'unplaced') {
      const next = { ...placements };
      delete next[active.id];
      setPlacements(next);
    } else if (categories.find((c) => c.id === over.id)) {
      setPlacements({ ...placements, [active.id]: over.id });
    }
  };

  const unplaced = items.filter((it) => !placements[it.id]);
  const allPlaced = unplaced.length === 0;

  const correctness = useMemo(() => {
    const r = {};
    items.forEach((it) => {
      if (placements[it.id]) {
        r[it.id] = placements[it.id] === it.correct_category;
      }
    });
    return r;
  }, [items, placements]);

  const correctCount = Object.values(correctness).filter(Boolean).length;
  const accuracy = items.length > 0 ? correctCount / items.length : 0;

  const getChipFeedback = (item) => {
    if (!checked && showExplanations !== 'after_each') return null;
    if (!checked && showExplanations === 'after_each' && !placements[item.id]) return null;
    if (!placements[item.id]) return null;
    return correctness[item.id];
  };

  const { setNodeRef: unplacedRef, isOver: unplacedIsOver } = useDroppable({ id: 'unplaced' });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragOver={(e) => setOverId(e.over?.id)}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-5" data-testid="interactive-categorize">
        {/* Unplaced pool */}
        <div
          ref={unplacedRef}
          className={`rounded-2xl p-4 border-2 border-dashed transition-all min-h-[80px] ${
            unplacedIsOver ? 'border-[var(--color-primary)]/60 bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] bg-[var(--color-surface)]/40'
          }`}
          data-testid="interactive-unplaced-pool"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
            Drag items into the right category
          </div>
          <div className="flex flex-wrap gap-2">
            {unplaced.length === 0 ? (
              <span className="text-xs font-mono text-[var(--color-text-faint)]">All placed ✓</span>
            ) : (
              unplaced.map((it) => (
                <DraggableChip key={it.id} id={it.id} text={it.text} />
              ))
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const placedItems = items.filter((it) => placements[it.id] === cat.id);
            return (
              <CategoryDropZone key={cat.id} id={cat.id} label={cat.label} color={cat.color || '#246BFD'} isOver={overId === cat.id}>
                {placedItems.map((it) => {
                  const fb = getChipFeedback(it);
                  return (
                    <div
                      key={it.id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bricolage border ${
                        fb === true
                          ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30 text-[var(--color-success)]'
                          : fb === false
                            ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]'
                      }`}
                    >
                      {fb === true && <CheckCircle2 size={12} />}
                      {fb === false && <XCircle size={12} />}
                      <DraggableChipInline id={it.id} text={it.text} disabled={fb === true} />
                    </div>
                  );
                })}
              </CategoryDropZone>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="interactive-score">
            {checked ? (
              <>
                <span className="text-[var(--color-text)] font-semibold">{correctCount}</span> / {items.length} correct · {Math.round(accuracy * 100)}%
              </>
            ) : (
              <>{Object.keys(placements).length} / {items.length} placed</>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!checked && (
              <button
                onClick={() => setChecked(true)}
                disabled={!allPlaced}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold font-bricolage hover:border-[var(--color-primary)]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="interactive-check"
              >
                Check Answers
              </button>
            )}
            <button
              onClick={() => onComplete({
                tasks_completed: correctCount,
                tasks_total: items.length,
                accuracy,
              })}
              disabled={!checked}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="interactive-complete"
            >
              Complete Simulation
            </button>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-primary)]/40 shadow-[0_8px_24px_rgba(36,107,253,0.3)] cursor-grabbing">
            <GripVertical size={14} className="text-[var(--color-primary)]" />
            <span className="text-sm font-bricolage text-[var(--color-text)]">
              {items.find((i) => i.id === activeId)?.text}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DraggableChipInline({ id, text, disabled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing select-none ${disabled ? 'cursor-not-allowed' : ''}`}
      style={{ opacity: isDragging ? 0 : 1 }}
    >
      {text}
    </span>
  );
}

/* =============================================================
   EXERCISE 2: ORDER — sortable list, compare to correct_position
   ============================================================= */
function SortableItem({ id, text, feedback, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const borderClass =
    feedback === true
      ? 'border-[var(--color-success)]/50 bg-[var(--color-success)]/8'
      : feedback === false
        ? 'border-[#EF4444]/50 bg-[#EF4444]/8'
        : 'border-[var(--color-border)] bg-[var(--color-surface)]/60';
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${borderClass} cursor-grab active:cursor-grabbing select-none transition-colors`}
      data-testid={`interactive-sortable-${id}`}
    >
      <div {...listeners} {...attributes} className="shrink-0">
        <GripVertical size={16} className="text-[var(--color-text-muted)]" />
      </div>
      <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
        {index + 1}
      </div>
      <span className="flex-1 text-sm font-bricolage text-[var(--color-text)]">{text}</span>
      {feedback === true && <CheckCircle2 size={15} className="text-[var(--color-success)]" />}
      {feedback === false && <XCircle size={15} className="text-[#EF4444]" />}
    </div>
  );
}

function OrderExercise({ config, onComplete }) {
  const items = config?.items || [];
  const partialCredit = config?.partial_credit ?? true;

  // Start shuffled (but deterministic per mount)
  const [order, setOrder] = useState(() => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.map((it) => it.id);
  });
  const [checked, setChecked] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIdx = prev.indexOf(active.id);
      const newIdx = prev.indexOf(over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const itemsById = Object.fromEntries(items.map((it) => [it.id, it]));

  const feedback = useMemo(() => {
    if (!checked) return {};
    const f = {};
    order.forEach((id, idx) => {
      const item = itemsById[id];
      if (!item) return;
      f[id] = item.correct_position === idx;
    });
    return f;
  }, [checked, order, itemsById]);

  const correctCount = Object.values(feedback).filter(Boolean).length;
  const total = items.length;
  // Partial credit: use correctCount. Non-partial: all-or-nothing
  const accuracy = total === 0 ? 0 : partialCredit ? correctCount / total : correctCount === total ? 1 : 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto" data-testid="interactive-order">
      <div className="glass-card rounded-2xl p-5">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-4">
          Drag to reorder
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {order.map((id, idx) => (
                <SortableItem
                  key={id}
                  id={id}
                  text={itemsById[id]?.text || id}
                  feedback={feedback[id]}
                  index={idx}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="interactive-score">
          {checked ? (
            <>
              <span className="text-[var(--color-text)] font-semibold">{correctCount}</span> / {total} in correct position · {Math.round(accuracy * 100)}%
            </>
          ) : (
            <>Arrange into the correct sequence</>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!checked && (
            <button
              onClick={() => setChecked(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold font-bricolage hover:border-[var(--color-primary)]/40 transition-all"
              data-testid="interactive-check"
            >
              Check Order
            </button>
          )}
          {checked && accuracy < 1 && (
            <button
              onClick={() => setChecked(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] transition-all"
              data-testid="interactive-retry"
            >
              <RefreshCw size={13} /> Retry
            </button>
          )}
          <button
            onClick={() => onComplete({
              tasks_completed: correctCount,
              tasks_total: total,
              accuracy,
            })}
            disabled={!checked}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="interactive-complete"
          >
            Complete Simulation
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================
   EXERCISE 3: MATCH — click a left, click a right → draw line
   ============================================================= */
function MatchExercise({ config, onComplete }) {
  const left = config?.left_items || [];
  const right = config?.right_items || [];
  const correctMatches = config?.correct_matches || {};
  const explanations = config?.explanations || {};

  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matches, setMatches] = useState({}); // { left_id: right_id }
  const [checked, setChecked] = useState(false);
  const leftRefs = useRef({});
  const rightRefs = useRef({});
  const containerRef = useRef(null);
  const [lines, setLines] = useState([]);

  const handleLeftClick = (id) => {
    if (checked && correctness[id]) return;
    setSelectedLeft(selectedLeft === id ? null : id);
  };

  const handleRightClick = (id) => {
    if (!selectedLeft) return;
    // Clear any prior pairing involving either side
    const next = { ...matches };
    Object.keys(next).forEach((l) => {
      if (next[l] === id) delete next[l];
    });
    next[selectedLeft] = id;
    setMatches(next);
    setSelectedLeft(null);
  };

  const correctness = useMemo(() => {
    const r = {};
    Object.entries(matches).forEach(([lId, rId]) => {
      r[lId] = correctMatches[lId] === rId;
    });
    return r;
  }, [matches, correctMatches]);

  const correctCount = checked ? Object.values(correctness).filter(Boolean).length : 0;
  const total = Object.keys(correctMatches).length;
  const accuracy = total > 0 ? correctCount / total : 0;

  // Draw SVG lines
  useEffect(() => {
    const compute = () => {
      if (!containerRef.current) return;
      const contRect = containerRef.current.getBoundingClientRect();
      const ls = [];
      Object.entries(matches).forEach(([lId, rId]) => {
        const lEl = leftRefs.current[lId];
        const rEl = rightRefs.current[rId];
        if (!lEl || !rEl) return;
        const lRect = lEl.getBoundingClientRect();
        const rRect = rEl.getBoundingClientRect();
        ls.push({
          x1: lRect.right - contRect.left,
          y1: lRect.top + lRect.height / 2 - contRect.top,
          x2: rRect.left - contRect.left,
          y2: rRect.top + rRect.height / 2 - contRect.top,
          lId, rId,
        });
      });
      setLines(ls);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [matches]);

  const allMatched = Object.keys(matches).length === left.length;

  const lineColor = (lId) => {
    if (!checked) return '#246BFD';
    return correctness[lId] ? '#10B981' : '#EF4444';
  };

  return (
    <div className="space-y-5" data-testid="interactive-match">
      <div ref={containerRef} className="relative glass-card rounded-2xl p-5 sm:p-6">
        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={lineColor(l.lId)}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={checked ? '0' : '6 4'}
              style={{ transition: 'stroke 0.3s' }}
            />
          ))}
        </svg>

        <div className="grid grid-cols-2 gap-4 sm:gap-8 relative" style={{ zIndex: 2 }}>
          {/* Left column */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">
              {config?.left_label || 'Items'}
            </div>
            {left.map((it) => {
              const isSelected = selectedLeft === it.id;
              const isMatched = !!matches[it.id];
              const fb = checked ? correctness[it.id] : null;
              return (
                <button
                  key={it.id}
                  ref={(el) => (leftRefs.current[it.id] = el)}
                  onClick={() => handleLeftClick(it.id)}
                  disabled={checked && fb}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    fb === true
                      ? 'bg-[var(--color-success)]/8 border-[var(--color-success)]/40 text-[var(--color-text)]'
                      : fb === false
                        ? 'bg-[#EF4444]/8 border-[#EF4444]/40 text-[var(--color-text)]'
                        : isSelected
                          ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/60 shadow-[0_0_16px_rgba(36,107,253,0.25)]'
                          : isMatched
                            ? 'bg-[var(--color-surface)]/80 border-[var(--color-border)] text-[var(--color-text)]'
                            : 'bg-[var(--color-surface)]/40 border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/40'
                  }`}
                  data-testid={`interactive-match-left-${it.id}`}
                >
                  <span className="text-sm font-bricolage">{it.text}</span>
                </button>
              );
            })}
          </div>

          {/* Right column */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">
              {config?.right_label || 'Matches'}
            </div>
            {right.map((it) => {
              const matchedFromLeft = Object.entries(matches).find(([, rId]) => rId === it.id)?.[0];
              const fb = checked && matchedFromLeft ? correctness[matchedFromLeft] : null;
              const isTargetable = !!selectedLeft;
              return (
                <button
                  key={it.id}
                  ref={(el) => (rightRefs.current[it.id] = el)}
                  onClick={() => handleRightClick(it.id)}
                  disabled={!isTargetable && !matchedFromLeft}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    fb === true
                      ? 'bg-[var(--color-success)]/8 border-[var(--color-success)]/40'
                      : fb === false
                        ? 'bg-[#EF4444]/8 border-[#EF4444]/40'
                        : isTargetable
                          ? 'bg-[var(--color-accent-purple)]/8 border-[var(--color-accent-purple)]/40 hover:bg-[var(--color-accent-purple)]/15'
                          : matchedFromLeft
                            ? 'bg-[var(--color-surface)]/80 border-[var(--color-border)]'
                            : 'bg-[var(--color-surface)]/40 border-[var(--color-border)]'
                  }`}
                  data-testid={`interactive-match-right-${it.id}`}
                >
                  <span className="text-sm font-bricolage text-[var(--color-text)]">{it.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Explanations */}
      {checked && Object.keys(explanations).length > 0 && (
        <div className="space-y-2" data-testid="interactive-match-explanations">
          {Object.entries(matches).map(([lId, rId]) => {
            const exp = explanations[lId];
            if (!exp) return null;
            const ok = correctness[lId];
            const leftText = left.find((x) => x.id === lId)?.text;
            return (
              <div
                key={lId}
                className={`rounded-xl p-3 border ${ok ? 'bg-[var(--color-success)]/8 border-[var(--color-success)]/25' : 'bg-[#EF4444]/8 border-[#EF4444]/25'}`}
              >
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: ok ? 'var(--color-success)' : '#EF4444' }}>
                  {leftText}
                </div>
                <p className="text-xs font-bricolage text-[var(--color-text)] leading-relaxed">{exp}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="interactive-score">
          {checked ? (
            <>
              <span className="text-[var(--color-text)] font-semibold">{correctCount}</span> / {total} matched correctly · {Math.round(accuracy * 100)}%
            </>
          ) : (
            <>{Object.keys(matches).length} / {left.length} matched</>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!checked && (
            <button
              onClick={() => setChecked(true)}
              disabled={!allMatched}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold font-bricolage hover:border-[var(--color-primary)]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="interactive-check"
            >
              Check Matches
            </button>
          )}
          <button
            onClick={() => onComplete({
              tasks_completed: correctCount,
              tasks_total: total,
              accuracy,
            })}
            disabled={!checked}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="interactive-complete"
          >
            Complete Simulation
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================
   EXERCISE 4: LABEL — drag labels onto template_svg drop zones
   ============================================================= */
function LabelDropZone({ id, x, y, width, height, label, feedback, isOver }) {
  const { setNodeRef } = useDroppable({ id });
  const borderColor =
    feedback === true ? '#10B981' : feedback === false ? '#EF4444' : isOver ? '#6A5CFF' : '#246BFD';
  const bg =
    feedback === true ? 'rgba(16,185,129,0.15)' : feedback === false ? 'rgba(239,68,68,0.15)' : isOver ? 'rgba(106,92,255,0.15)' : 'rgba(36,107,253,0.08)';
  return (
    <div
      ref={setNodeRef}
      className="absolute rounded-lg border-2 border-dashed flex items-center justify-center text-xs font-bricolage text-center p-1.5 transition-all"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
        borderColor,
        background: bg,
      }}
      data-testid={`interactive-label-zone-${id}`}
    >
      {label ? (
        <span className="text-[var(--color-text)] font-semibold">{label}</span>
      ) : (
        <span className="text-[var(--color-text-faint)] text-[10px] font-mono uppercase tracking-wider">Drop here</span>
      )}
    </div>
  );
}

function LabelDraggable({ id, text, placed }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: placed,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : placed ? 0.35 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] ${
        placed ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)]/40'
      } transition-all select-none`}
      data-testid={`interactive-label-${id}`}
    >
      <GripVertical size={12} className="text-[var(--color-text-muted)]" />
      <span className="text-sm font-bricolage text-[var(--color-text)]">{text}</span>
    </div>
  );
}

function LabelExercise({ config, onComplete }) {
  const templateSvg = config?.template_svg || '';
  const dropZones = config?.drop_zones || [];
  const labels = config?.labels || [];

  const [placements, setPlacements] = useState({}); // { zoneId: labelId }
  const [checked, setChecked] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } })
  );

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    setOverId(null);
    if (!over) return;
    if (dropZones.find((z) => z.id === over.id)) {
      // Clear any label already in that zone
      const next = { ...placements };
      Object.keys(next).forEach((zId) => {
        if (next[zId] === active.id) delete next[zId];
      });
      next[over.id] = active.id;
      setPlacements(next);
    }
  };

  const labelsById = Object.fromEntries(labels.map((l) => [l.id, l]));
  const placedLabelIds = new Set(Object.values(placements));

  const correctness = useMemo(() => {
    const r = {};
    dropZones.forEach((z) => {
      if (placements[z.id]) {
        r[z.id] = placements[z.id] === z.correct_label;
      }
    });
    return r;
  }, [dropZones, placements]);

  const correctCount = checked ? Object.values(correctness).filter(Boolean).length : 0;
  const total = dropZones.length;
  const accuracy = total > 0 ? correctCount / total : 0;
  const allPlaced = Object.keys(placements).length === total;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragOver={(e) => setOverId(e.over?.id)}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-5" data-testid="interactive-label">
        {/* Template with drop zones */}
        <div className="glass-card rounded-2xl p-5">
          <div className="relative w-full aspect-[16/9] bg-white rounded-xl overflow-hidden">
            {templateSvg ? (
              <div
                className="absolute inset-0"
                dangerouslySetInnerHTML={{ __html: templateSvg }}
                data-testid="interactive-label-template"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm font-mono text-[#64748B]">
                (template)
              </div>
            )}
            {dropZones.map((z) => {
              const labelId = placements[z.id];
              const text = labelId ? labelsById[labelId]?.text : null;
              return (
                <LabelDropZone
                  key={z.id}
                  id={z.id}
                  x={z.x}
                  y={z.y}
                  width={z.width}
                  height={z.height}
                  label={text}
                  feedback={checked ? correctness[z.id] : null}
                  isOver={overId === z.id}
                />
              );
            })}
          </div>
        </div>

        {/* Draggable labels pool */}
        <div className="glass-card rounded-2xl p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
            Drag labels onto the diagram
          </div>
          <div className="flex flex-wrap gap-2">
            {labels.map((lbl) => (
              <LabelDraggable key={lbl.id} id={lbl.id} text={lbl.text} placed={placedLabelIds.has(lbl.id)} />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-mono text-[var(--color-text-muted)]" data-testid="interactive-score">
            {checked ? (
              <>
                <span className="text-[var(--color-text)] font-semibold">{correctCount}</span> / {total} correct · {Math.round(accuracy * 100)}%
              </>
            ) : (
              <>{Object.keys(placements).length} / {total} labels placed</>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!checked && (
              <button
                onClick={() => setChecked(true)}
                disabled={!allPlaced}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold font-bricolage hover:border-[var(--color-primary)]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="interactive-check"
              >
                Check Labels
              </button>
            )}
            <button
              onClick={() => onComplete({
                tasks_completed: correctCount,
                tasks_total: total,
                accuracy,
              })}
              disabled={!checked}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent-purple)] text-white text-sm font-semibold font-bricolage hover:shadow-[0_0_24px_rgba(36,107,253,0.4)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="interactive-complete"
            >
              Complete Simulation
            </button>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-primary)]/60 shadow-[0_8px_24px_rgba(36,107,253,0.3)]">
            <GripVertical size={12} className="text-[var(--color-primary)]" />
            <span className="text-sm font-bricolage text-[var(--color-text)]">
              {labelsById[activeId]?.text}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* =============================================================
   DISPATCHER
   ============================================================= */
export default function InteractiveSim({ config, title, onComplete }) {
  const exerciseType = config?.exercise_type;

  // Legacy fallback: if config shape uses `modules` (slider_interactive lab pattern),
  // route to the ModuleLab renderer so users get a working interactive simulation
  // instead of the "Unsupported" empty state.
  if (!exerciseType && Array.isArray(config?.modules) && config.modules.length > 0) {
    return <ModuleLab config={config} onComplete={onComplete} />;
  }

  if (exerciseType === 'categorize') {
    return <CategorizeExercise config={config} onComplete={onComplete} />;
  }
  if (exerciseType === 'order') {
    return <OrderExercise config={config} onComplete={onComplete} />;
  }
  if (exerciseType === 'match') {
    return <MatchExercise config={config} onComplete={onComplete} />;
  }
  if (exerciseType === 'label') {
    return <LabelExercise config={config} onComplete={onComplete} />;
  }
  // Ultimate fallback for any unknown interactive shape — render all
  // config fields as readable cards + "Mark as Complete" button.
  return <GenericRenderer config={config} title={title} typeLabel="Interactive" onComplete={onComplete} />;
}
