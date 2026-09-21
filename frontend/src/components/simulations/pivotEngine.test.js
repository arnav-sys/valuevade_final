// Unit tests for the PivotTable engine. Run:
//   cd /app/frontend && yarn test --watchAll=false --testPathPattern=pivotEngine
import {
  aggregateValues, computePivot, gradePivotSheet, valueId, AGGREGATIONS,
} from './pivotEngine';

const NSE = {
  headers: ['Sector', 'Quarter', 'Revenue', 'Margin'],
  rows: [
    ['Banking',  'Q1', 12450, 18.5],
    ['Banking',  'Q2', 13100, 19.1],
    ['Banking',  'Q3', 13880, 19.6],
    ['Banking',  'Q4', 14500, 20.2],
    ['IT',       'Q1',  9870, 24.0],
    ['IT',       'Q2', 10240, 24.4],
    ['IT',       'Q3', 10880, 24.9],
    ['IT',       'Q4', 11500, 25.2],
    ['FMCG',     'Q1',  6500, 16.1],
    ['FMCG',     'Q2',  6800, 16.4],
    ['FMCG',     'Q3',  7100, 16.7],
    ['FMCG',     'Q4',  7400, 17.0],
  ],
};

describe('pivotEngine, aggregateValues', () => {
  test('SUM', () => expect(aggregateValues([1, 2, 3], 'SUM')).toBe(6));
  test('AVERAGE', () => expect(aggregateValues([2, 4, 6], 'AVERAGE')).toBe(4));
  test('COUNT (numeric only)', () => expect(aggregateValues([1, 2, '', null, 'foo'], 'COUNT')).toBe(2));
  test('COUNTA (non-empty)', () => expect(aggregateValues([1, 'foo', '', null, 0], 'COUNTA')).toBe(3));
  test('MAX', () => expect(aggregateValues([1, 9, 4], 'MAX')).toBe(9));
  test('MIN', () => expect(aggregateValues([5, 1, 3], 'MIN')).toBe(1));
  test('STDEV (sample)', () => {
    // Sample stdev of {2,4,4,4,5,5,7,9} = ~2.138
    expect(aggregateValues([2, 4, 4, 4, 5, 5, 7, 9], 'STDEV')).toBeCloseTo(2.138, 2);
  });
  test('handles ₹/commas in values', () => {
    expect(aggregateValues(['₹1,000', '₹2,500'], 'SUM')).toBe(3500);
  });
  test('AGGREGATIONS list exposes all', () => {
    expect(AGGREGATIONS).toContain('SUM');
    expect(AGGREGATIONS).toContain('STDEV');
  });
});

describe('pivotEngine, computePivot', () => {
  test('empty state → no rows / no cols / no values', () => {
    const out = computePivot(NSE, { rows: [], columns: [], values: [] });
    expect(out.rowKeys).toEqual([[]]);  // one empty tuple = "grand-only"
    expect(out.valueIds).toEqual([]);
  });

  test('Sector in rows, no cols, SUM(Revenue) values', () => {
    const out = computePivot(NSE, {
      rows: ['Sector'], columns: [], values: [{ field: 'Revenue', agg: 'SUM' }],
    });
    expect(out.rowKeys.map((r) => r[0])).toEqual(['Banking', 'FMCG', 'IT']);   // alpha sort
    expect(out.cells['Banking']['']).toEqual({ 'SUM(Revenue)': 53930 });
    expect(out.cells['IT']['']['SUM(Revenue)']).toBe(42490);
    expect(out.grandTotal['SUM(Revenue)']).toBe(124220);
  });

  test('Sector × Quarter cross-tab with SUM(Revenue)', () => {
    const out = computePivot(NSE, {
      rows: ['Sector'], columns: ['Quarter'], values: [{ field: 'Revenue', agg: 'SUM' }],
    });
    expect(out.colKeys.map((c) => c[0])).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(out.cells['Banking']['Q1']['SUM(Revenue)']).toBe(12450);
    expect(out.cells['IT']['Q4']['SUM(Revenue)']).toBe(11500);
    // Row total: Banking sum across all quarters
    expect(out.rowTotals['Banking']['SUM(Revenue)']).toBe(53930);
    // Col total: Q1 sum across all sectors
    expect(out.colTotals['Q1']['SUM(Revenue)']).toBe(12450 + 9870 + 6500);
  });

  test('AVERAGE aggregation', () => {
    const out = computePivot(NSE, {
      rows: ['Sector'], columns: [], values: [{ field: 'Margin', agg: 'AVERAGE' }],
    });
    expect(out.cells['Banking']['']['AVERAGE(Margin)']).toBeCloseTo((18.5 + 19.1 + 19.6 + 20.2) / 4, 4);
  });

  test('Two value fields side by side', () => {
    const out = computePivot(NSE, {
      rows: ['Sector'], columns: [],
      values: [{ field: 'Revenue', agg: 'SUM' }, { field: 'Margin', agg: 'AVERAGE' }],
    });
    expect(out.valueIds).toEqual(['SUM(Revenue)', 'AVERAGE(Margin)']);
    expect(out.cells['IT']['']['SUM(Revenue)']).toBe(42490);
    expect(out.cells['IT']['']['AVERAGE(Margin)']).toBeCloseTo(24.625, 3);
  });

  test('Filter narrows result set', () => {
    const out = computePivot(NSE, {
      rows: ['Sector'], columns: [],
      values: [{ field: 'Revenue', agg: 'SUM' }],
      filters: [{ field: 'Quarter', allowed: ['Q4'] }],
    });
    expect(out.cells['Banking']['']['SUM(Revenue)']).toBe(14500);
    expect(out.cells['IT']['']['SUM(Revenue)']).toBe(11500);
  });

  test('valueId encodes field+agg uniquely', () => {
    expect(valueId({ field: 'Revenue', agg: 'SUM' })).toBe('SUM(Revenue)');
    expect(valueId({ field: 'Revenue' })).toBe('SUM(Revenue)');     // default agg
    expect(valueId({ field: 'Margin', agg: 'avg' })).toBe('AVG(Margin)');
  });
});

describe('pivotEngine, gradePivotSheet', () => {
  const expected = {
    rows:    ['Sector'],
    columns: ['Quarter'],
    values:  [{ field: 'Revenue', agg: 'SUM' }],
    filters: [],
  };

  test('exact match → correct', () => {
    const g = gradePivotSheet(expected, expected, NSE);
    expect(g.correct).toBe(true);
    expect(g.partial_credit).toBeCloseTo(1, 2);
  });

  test('reversed rows/cols → not correct (set mismatch)', () => {
    const wrong = { ...expected, rows: ['Quarter'], columns: ['Sector'] };
    const g = gradePivotSheet(wrong, expected, NSE);
    expect(g.correct).toBe(false);
  });

  test('wrong aggregation → not correct, partial credit > 0', () => {
    const wrong = { ...expected, values: [{ field: 'Revenue', agg: 'AVERAGE' }] };
    const g = gradePivotSheet(wrong, expected, NSE);
    expect(g.correct).toBe(false);
    expect(g.partial_credit).toBeGreaterThan(0);
    expect(g.partial_credit).toBeLessThan(1);
  });

  test('expected_cells matched within tolerance → correct', () => {
    const cells = [
      { row_label: 'Banking', col_label: 'Q1', value: 12450, tolerance: 1 },
      { row_label: 'IT', col_label: 'Q4', value: 11500, tolerance: 1 },
    ];
    const g = gradePivotSheet(expected, expected, NSE, cells);
    expect(g.correct).toBe(true);
    expect(g.breakdown.cells_passed).toBe(2);
  });

  test('expected_cells off → not correct but partial credit > 0', () => {
    const cells = [
      { row_label: 'Banking', col_label: 'Q1', value: 99999, tolerance: 1 },
    ];
    const g = gradePivotSheet(expected, expected, NSE, cells);
    expect(g.correct).toBe(false);
    expect(g.breakdown.cells_passed).toBe(0);
    expect(g.partial_credit).toBeLessThan(1);
  });

  test('case-insensitive field matching', () => {
    const current = { ...expected, rows: ['sector'], columns: ['quarter'] };
    const g = gradePivotSheet(current, expected, NSE);
    expect(g.correct).toBe(true);
  });

  test('extra unexpected field → not correct', () => {
    const current = { ...expected, rows: ['Sector', 'Margin'] };
    const g = gradePivotSheet(current, expected, NSE);
    expect(g.correct).toBe(false);
    expect(g.partial_credit).toBeLessThan(1);
  });
});
