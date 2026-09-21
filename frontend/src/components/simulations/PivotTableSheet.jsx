// PivotTableSheet, real Excel-style PivotTable UI built on @dnd-kit/core.
//
// Props:
//   spec: {
//     source: { sheet, range },            // where the data lives
//     initial_state: { rows, columns, values, filters },
//     expected_state, expected_cells       // (only used at grading time)
//   }
//   sourceData: { headers: [], rows: [[]] }  // already-resolved from the
//                                            // referenced sheet+range
//   state: { rows, columns, values, filters } // current user state
//   onChange(state) → void                  // called on every user mutation
//   readOnly: boolean                       // post-submit view
//
// Internal architecture:
//   – Left rail = `FieldListPanel` (DnD source).
//   – Body = 4 `DropZone`s (rows / columns / values / filters).
//   – Right side = `PivotGrid` rendering computePivot() output.
//   – All drag interactions are @dnd-kit/core with a custom DragOverlay so the
//     dragged chip floats with the cursor and keyboard-arrow drag works
//     (a11y).

import React, { useMemo, useState } from 'react';
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDraggable, useDroppable, DragOverlay,
} from '@dnd-kit/core';
import {
  Layers, Filter, Columns3, Rows3, Sigma, ChevronDown, X, RefreshCw,
} from 'lucide-react';
import { computePivot, valueId, AGGREGATIONS } from './pivotEngine';

const ZONE_DEFS = [
  { id: 'filters', label: 'Filters', icon: Filter,   hint: 'Drop fields to filter the whole pivot' },
  { id: 'columns', label: 'Columns', icon: Columns3, hint: 'Drop fields to break out across columns' },
  { id: 'rows',    label: 'Rows',    icon: Rows3,    hint: 'Drop fields to group rows' },
  { id: 'values',  label: 'Values',  icon: Sigma,    hint: 'Drop numeric fields to aggregate' },
];

function classNames(...x) { return x.filter(Boolean).join(' '); }

function formatCell(v) {
  if (v == null || (typeof v === 'number' && !Number.isFinite(v))) return '';
  if (typeof v !== 'number') return String(v);
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  // Indian locale thousands separator (en-IN groups 12,34,567)
  const opts = abs >= 100 ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return v.toLocaleString('en-IN', opts);
}

/* ─────────── Draggable field chip ─────────── */
function FieldChip({ id, label, agg, onAggChange, onRemove, dim = 'small', dragHandleId, fromZone }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: dragHandleId,
    data: { label, fromZone },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const isValueChip = !!onAggChange;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames(
        'rounded-lg border flex items-center gap-1 select-none',
        'border-[var(--color-border)] bg-[var(--color-bg-card)]',
        isValueChip
          ? 'px-2 py-1.5'
          : 'px-2.5 py-1.5 hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface)] transition-colors',
        isDragging ? 'opacity-30' : '',
        dim === 'big' ? 'text-sm' : 'text-xs',
        'font-mono',
      )}
      data-testid={`pivot-chip-${id}`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing flex items-center gap-1.5 text-[var(--color-text)] outline-none"
        aria-label={`Drag field ${label}`}
      >
        <Layers size={11} className="text-[var(--color-text-muted)] shrink-0" />
        <span className="truncate max-w-[120px]">{label}</span>
      </button>
      {isValueChip && (
        <select
          value={agg}
          onChange={(e) => onAggChange(e.target.value)}
          className="bg-transparent border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:text-[var(--color-text)] outline-none"
          data-testid={`pivot-agg-${label}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {AGGREGATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors p-0.5"
          aria-label={`Remove field ${label}`}
          data-testid={`pivot-remove-${label}`}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

/* ─────────── DropZone ─────────── */
function DropZone({ zone, chips, onAggChange, onRemove, readOnly }) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone-${zone.id}`, data: { zone: zone.id } });
  const Icon = zone.icon;
  return (
    <div
      ref={setNodeRef}
      className={classNames(
        'rounded-xl border-2 border-dashed p-3 min-h-[64px] transition-all',
        isOver ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/[0.06]'
               : 'border-[var(--color-border)] bg-[var(--color-bg-card)]',
        readOnly ? 'opacity-70' : '',
      )}
      data-testid={`pivot-zone-${zone.id}`}
    >
      <div className="flex items-center gap-2 mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        <Icon size={11} />
        <span>{zone.label}</span>
        <span className="text-[var(--color-text-faint)]">· {chips.length}</span>
      </div>
      {chips.length === 0 ? (
        <div className="text-[10px] text-[var(--color-text-faint)] italic px-1 leading-relaxed">{zone.hint}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">{chips}</div>
      )}
    </div>
  );
}

/* ─────────── Field list panel ─────────── */
function FieldListPanel({ headers, usedFields }) {
  // Available fields = all source headers (already-used ones still draggable
  // so users can add a field to a 2nd zone if they want).
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 w-full lg:w-56 shrink-0">
      <div className="flex items-center gap-2 mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        <Layers size={11} />
        <span>Fields</span>
        <span className="text-[var(--color-text-faint)]">· {headers.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[260px] overflow-auto pr-1">
        {headers.map((h, i) => (
          <FieldChip
            key={h + '__src'}
            id={`src-${i}`}
            label={h}
            dragHandleId={`field|${h}|source`}
            fromZone={null}
            dim="small"
          />
        ))}
        {!headers.length && (
          <div className="text-[10px] text-[var(--color-text-faint)] italic">No fields detected. Check the source range.</div>
        )}
      </div>
      {usedFields.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-faint)]">
          {usedFields.length} field{usedFields.length === 1 ? '' : 's'} placed
        </div>
      )}
    </div>
  );
}

/* ─────────── Pivot grid render ─────────── */
function PivotGrid({ pivot, showSubtotals = true, showGrandTotals = true }) {
  const { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal, valueIds, rowFields, colFields } = pivot;
  if (!valueIds.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-xs text-[var(--color-text-muted)] font-mono" data-testid="pivot-grid-empty">
        Drop a numeric field into <span className="text-[var(--color-text)] font-semibold">Values</span> to start the cross-tab.
      </div>
    );
  }
  const rowDepth = Math.max(1, rowFields.length);
  const colDepth = Math.max(1, colFields.length);
  const valuesAcross = valueIds.length;
  const showColTotals = showGrandTotals && colKeys.length > 1;

  // Helper: render a value triple inside a cell
  const renderValuesCell = (valuesObj, opts = {}) => (
    <div className={`flex items-center justify-end gap-3 ${opts.bold ? 'font-semibold' : ''}`}>
      {valueIds.map((vid) => (
        <span key={vid} className="tabular-nums">{formatCell(valuesObj[vid])}</span>
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-auto" data-testid="pivot-grid">
      <table className="w-full text-xs font-mono">
        <thead>
          {/* Column field header(s) */}
          {colFields.length > 0 && colFields.map((cf, ci) => (
            <tr key={`cfhdr-${ci}`}>
              <th colSpan={rowDepth} className="px-3 py-1.5 bg-[var(--color-surface)] text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                {ci === colFields.length - 1 ? cf : ''}
              </th>
              {colKeys.map((ck) => (
                <th
                  key={ck.join('║') + `_h${ci}`}
                  colSpan={valuesAcross}
                  className="px-3 py-1.5 bg-[var(--color-surface)] text-center text-[10px] uppercase tracking-wider text-[var(--color-text)] border-l border-[var(--color-border)]"
                >
                  {ck[ci]}
                </th>
              ))}
              {showColTotals && (
                <th colSpan={valuesAcross} className="px-3 py-1.5 bg-[var(--color-surface)] text-center text-[10px] uppercase tracking-wider text-[var(--color-primary)] border-l border-[var(--color-border)]">
                  {ci === colFields.length - 1 ? 'Grand Total' : ''}
                </th>
              )}
            </tr>
          ))}
          {/* Value-id row */}
          <tr>
            {/* Row-field header labels */}
            {Array.from({ length: rowDepth }).map((_, ri) => (
              <th key={`rfhdr-${ri}`}
                  className="px-3 py-1.5 bg-[var(--color-surface)]/60 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
                {rowFields[ri] || ''}
              </th>
            ))}
            {colKeys.map((ck) => (
              valueIds.map((vid) => (
                <th key={ck.join('║') + '_' + vid}
                    className="px-3 py-1.5 bg-[var(--color-surface)]/60 text-right text-[10px] text-[var(--color-text-muted)] border-t border-l border-[var(--color-border)] tabular-nums">
                  {vid}
                </th>
              ))
            ))}
            {showColTotals && valueIds.map((vid) => (
              <th key={'gtot_' + vid} className="px-3 py-1.5 bg-[var(--color-surface)]/60 text-right text-[10px] text-[var(--color-primary)] border-t border-l border-[var(--color-border)] tabular-nums">
                {vid}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((rk, ri) => {
            const rkStr = rk.map((v) => (v == null ? '∅' : String(v))).join('║');
            return (
              <tr key={rkStr || '__only'} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface)]/40">
                {rowFields.length === 0 ? (
                  <td className="px-3 py-1.5 text-[var(--color-text-muted)]">Total</td>
                ) : (
                  rk.map((v, ci) => (
                    <td key={`rk-${ri}-${ci}`}
                        className="px-3 py-1.5 text-[var(--color-text)] truncate max-w-[160px]">
                      {v ?? '—'}
                    </td>
                  ))
                )}
                {colKeys.map((ck) => {
                  const ckStr = ck.map((v) => (v == null ? '∅' : String(v))).join('║');
                  const cell = cells[rkStr]?.[ckStr] || {};
                  return valueIds.map((vid) => (
                    <td key={`cell-${rkStr}-${ckStr}-${vid}`}
                        className="px-3 py-1.5 text-right text-[var(--color-text)] border-l border-[var(--color-border)] tabular-nums"
                        data-pivot-row={rk[rk.length - 1] ?? ''}
                        data-pivot-col={ck[ck.length - 1] ?? ''}
                        data-pivot-value-id={vid}
                    >
                      {formatCell(cell[vid])}
                    </td>
                  ));
                })}
                {showColTotals && valueIds.map((vid) => (
                  <td key={`rowtot-${rkStr}-${vid}`}
                      className="px-3 py-1.5 text-right font-semibold text-[var(--color-primary)] border-l border-[var(--color-border)] tabular-nums">
                    {formatCell(rowTotals[rkStr]?.[vid])}
                  </td>
                ))}
              </tr>
            );
          })}
          {/* Grand total row */}
          {showGrandTotals && (rowKeys.length > 1 || rowFields.length > 0) && (
            <tr className="border-t-2 border-[var(--color-primary)]/40 bg-[var(--color-primary)]/[0.04]">
              <td colSpan={rowDepth} className="px-3 py-1.5 font-semibold text-[var(--color-primary)] uppercase tracking-wider text-[10px]">
                Grand Total
              </td>
              {colKeys.map((ck) => {
                const ckStr = ck.map((v) => (v == null ? '∅' : String(v))).join('║');
                return valueIds.map((vid) => (
                  <td key={`coltot-${ckStr}-${vid}`}
                      className="px-3 py-1.5 text-right font-semibold text-[var(--color-primary)] border-l border-[var(--color-border)] tabular-nums">
                    {formatCell(colTotals[ckStr]?.[vid])}
                  </td>
                ));
              })}
              {showColTotals && valueIds.map((vid) => (
                <td key={`gtot-${vid}`} className="px-3 py-1.5 text-right font-semibold text-[var(--color-primary)] border-l border-[var(--color-border)] tabular-nums">
                  {formatCell(grandTotal[vid])}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────── Filter dropdown ─────────── */
function FilterChipWithDropdown({ field, headers, sourceRows, allowed, onChange, onRemove, fromZone, idx }) {
  const [open, setOpen] = useState(false);
  const colIdx = headers.findIndex((h) => h.toLowerCase() === field.toLowerCase());
  const allValues = useMemo(() => {
    if (colIdx < 0) return [];
    const set = new Set();
    sourceRows.forEach((r) => { if (r[colIdx] != null) set.add(String(r[colIdx])); });
    return Array.from(set).sort();
  }, [colIdx, sourceRows]);
  return (
    <div className="relative">
      <div className="flex items-stretch">
        <FieldChip
          id={`filt-${idx}`}
          label={field}
          fromZone="filters"
          dragHandleId={`field|${field}|filters`}
          onRemove={onRemove}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-1 px-1.5 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          data-testid={`pivot-filter-dropdown-${field}`}
        >
          {allowed.length ? `${allowed.length}/${allValues.length}` : 'All'}
          <ChevronDown size={9} className="inline ml-0.5" />
        </button>
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl p-2 min-w-[160px]">
          {allValues.map((v) => {
            const checked = allowed.includes(v);
            return (
              <label key={v} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-[var(--color-surface)] rounded cursor-pointer">
                <input type="checkbox" checked={checked}
                       onChange={(e) => {
                         const next = e.target.checked ? [...allowed, v] : allowed.filter((x) => x !== v);
                         onChange(next);
                       }} />
                <span className="text-[var(--color-text)] font-mono">{v}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────── The actual sheet component ─────────── */
export default function PivotTableSheet({
  spec, sourceData, state, onChange, readOnly = false,
}) {
  const headers = sourceData?.headers || [];
  const rows    = sourceData?.rows    || [];
  const [activeChip, setActiveChip] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
                             useSensor(KeyboardSensor));

  const pivot = useMemo(() => computePivot(sourceData, state), [sourceData, state]);

  const onDragStart = (ev) => {
    if (readOnly) return;
    setActiveChip(ev.active?.data?.current?.label ?? null);
  };
  const onDragEnd = (ev) => {
    setActiveChip(null);
    if (readOnly) return;
    const { active, over } = ev;
    if (!over) return;
    const droppedZone = over.data?.current?.zone;
    if (!droppedZone) return;
    const { label, fromZone } = active.data.current;

    const next = {
      rows:    [...(state.rows || [])],
      columns: [...(state.columns || [])],
      values:  [...(state.values || [])],
      filters: [...(state.filters || [])],
    };
    // Remove from source zone first (if dragged from a zone, not the field rail)
    if (fromZone) {
      if (fromZone === 'values') {
        next.values = next.values.filter((v) => v.field !== label);
      } else {
        next[fromZone] = next[fromZone].filter((f) =>
          fromZone === 'filters' ? f.field !== label : f !== label);
      }
    }
    // Add to dropped zone (idempotent)
    if (droppedZone === 'values') {
      if (!next.values.some((v) => v.field === label)) next.values.push({ field: label, agg: 'SUM' });
    } else if (droppedZone === 'filters') {
      if (!next.filters.some((f) => f.field === label)) next.filters.push({ field: label, allowed: [] });
    } else {
      if (!next[droppedZone].includes(label)) next[droppedZone].push(label);
    }
    onChange(next);
  };

  const updateValueAgg = (field, agg) => {
    const next = { ...state, values: state.values.map((v) => v.field === field ? { ...v, agg } : v) };
    onChange(next);
  };
  const removeFromZone = (zoneId, label) => {
    const next = { ...state };
    if (zoneId === 'values') next.values = state.values.filter((v) => v.field !== label);
    else if (zoneId === 'filters') next.filters = state.filters.filter((f) => f.field !== label);
    else next[zoneId] = (state[zoneId] || []).filter((f) => f !== label);
    onChange(next);
  };
  const updateFilterAllowed = (field, allowed) => {
    const next = { ...state, filters: state.filters.map((f) => f.field === field ? { ...f, allowed } : f) };
    onChange(next);
  };

  const usedFields = [
    ...(state.rows || []),
    ...(state.columns || []),
    ...(state.values || []).map((v) => v.field),
    ...(state.filters || []).map((f) => f.field),
  ];

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-3" data-testid="pivot-sheet">
        {/* Source row */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[var(--color-text-muted)]">Source:</span>
          <span className="px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
            {spec?.source?.sheet}!{spec?.source?.range}
          </span>
          <span className="text-[var(--color-text-faint)] ml-2">{rows.length} rows · {headers.length} fields</span>
          <button
            type="button"
            onClick={() => onChange({ ...state })}
            className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1 rounded hover:bg-[var(--color-surface)]"
            title="Refresh pivot"
            data-testid="pivot-refresh-btn"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Mobile notice */}
        <div className="lg:hidden text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-warning,#F59E0B)]/10 border border-[var(--color-warning,#F59E0B)]/30 rounded-lg px-2 py-1.5">
          PivotTable best on desktop. Tap-to-select drag fallback isn't enabled, please use a larger screen.
        </div>

        {/* Top: field rail + zones */}
        <div className="flex flex-col lg:flex-row gap-3">
          <FieldListPanel headers={headers} usedFields={usedFields} />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ZONE_DEFS.map((zone) => {
              const chips =
                zone.id === 'values'
                  ? state.values.map((v) => (
                      <FieldChip
                        key={`val-${v.field}`}
                        id={`val-${v.field}`}
                        label={v.field}
                        fromZone="values"
                        dragHandleId={`field|${v.field}|values`}
                        agg={v.agg}
                        onAggChange={(a) => updateValueAgg(v.field, a)}
                        onRemove={readOnly ? null : (() => removeFromZone('values', v.field))}
                      />
                    ))
                  : zone.id === 'filters'
                    ? state.filters.map((f, i) => (
                        <FilterChipWithDropdown
                          key={`filt-${f.field}`}
                          idx={i}
                          field={f.field}
                          headers={headers}
                          sourceRows={rows}
                          allowed={f.allowed || []}
                          onChange={(allowed) => updateFilterAllowed(f.field, allowed)}
                          onRemove={readOnly ? null : (() => removeFromZone('filters', f.field))}
                          fromZone="filters"
                        />
                      ))
                    : (state[zone.id] || []).map((field) => (
                        <FieldChip
                          key={`${zone.id}-${field}`}
                          id={`${zone.id}-${field}`}
                          label={field}
                          fromZone={zone.id}
                          dragHandleId={`field|${field}|${zone.id}`}
                          onRemove={readOnly ? null : (() => removeFromZone(zone.id, field))}
                        />
                      ));
              return <DropZone key={zone.id} zone={zone} chips={chips} readOnly={readOnly} />;
            })}
          </div>
        </div>

        {/* Pivot output */}
        <PivotGrid pivot={pivot} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeChip ? (
          <div className="rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)]/15 px-2.5 py-1.5 text-xs font-mono text-[var(--color-text)] shadow-2xl">
            <Layers size={11} className="inline mr-1.5 text-[var(--color-primary)]" />
            {activeChip}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
