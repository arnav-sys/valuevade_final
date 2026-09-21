// Template (non-LLM) evaluator for interview responses.
// Produces { scores: {technical, communication, structure, overall}, feedback: {strengths[], improvements[]} }.
// Scale: 1-5 per criterion. Overall is rounded average.

function toArr(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === 'object') return Object.values(v);
  return [v];
}

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.text || v.point || v.description || JSON.stringify(v);
  return String(v);
}

const CONNECTORS = [
  'first', 'second', 'third', 'finally', 'because', 'therefore', 'however',
  'overall', 'in summary', 'for example', 'specifically', 'in contrast',
  'on the other hand', 'moreover', 'additionally',
];

export function evaluateAnswer(answer, evaluationCriteria) {
  const raw = (answer || '').trim();
  const text = raw.toLowerCase();
  const len = raw.length;

  const criteria = evaluationCriteria || {};
  const keywords = toArr(criteria.keywords).map(asText).filter(Boolean);
  const keyPoints = toArr(criteria.key_points || criteria.keyPoints).map(asText).filter(Boolean);

  const keywordHits = keywords.filter((k) => text.includes(k.toLowerCase()));
  const keywordMissed = keywords.filter((k) => !text.includes(k.toLowerCase()));

  const keyPointsCovered = keyPoints.filter((p) => {
    const words = p.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return words.length === 0 || words.some((w) => text.includes(w));
  });
  const keyPointsMissed = keyPoints.filter((p) => !keyPointsCovered.includes(p));

  const sentences = raw.split(/[.!?]+\s*/).filter((s) => s.trim().length > 0).length;
  const connectorHits = CONNECTORS.filter((c) => text.includes(c)).length;

  // Technical score: keyword + key-point coverage
  const kwRate = keywords.length ? keywordHits.length / keywords.length : 0.6;
  const kpRate = keyPoints.length ? keyPointsCovered.length / keyPoints.length : 0.6;
  const technicalRaw = (kwRate * 0.5 + kpRate * 0.5) * 5;
  const technical = clamp(Math.round(technicalRaw || 1), 1, 5);

  // Communication: length heuristic
  let communication;
  if (len >= 400) communication = 5;
  else if (len >= 220) communication = 4;
  else if (len >= 130) communication = 3;
  else if (len >= 70) communication = 2;
  else communication = 1;
  if (len > 1400) communication = Math.max(3, communication - 1);

  // Structure: sentences + connectors
  let structure = 2;
  if (sentences >= 3) structure += 1;
  if (sentences >= 6) structure += 1;
  if (connectorHits >= 2) structure += 1;
  structure = clamp(structure, 1, 5);

  const overall = clamp(Math.round((technical + communication + structure) / 3), 1, 5);

  // Feedback
  const strengths = [];
  if (keywordHits.length) {
    strengths.push(`Hit key concepts: ${keywordHits.slice(0, 3).join(', ')}`);
  }
  if (keyPoints.length && kpRate >= 0.5) {
    strengths.push(`Addressed ${keyPointsCovered.length} of ${keyPoints.length} core points interviewers look for`);
  }
  if (len >= 220) strengths.push('Strong depth, you gave enough context to show your thinking');
  if (sentences >= 4) strengths.push('Multi-point answer with clear flow');
  if (connectorHits >= 2) strengths.push('Used structural phrases to guide the listener');
  if (!strengths.length) strengths.push('You took a clear stance, good starting point');

  const improvements = [];
  if (keyPointsMissed.length) {
    const show = keyPointsMissed.slice(0, 2).map((p) => truncate(p, 80));
    improvements.push(`Consider addressing: ${show.join('; ')}`);
  }
  if (keywordMissed.length && keywordMissed.length >= Math.max(1, keywords.length / 2)) {
    improvements.push(`Try weaving in: ${keywordMissed.slice(0, 3).join(', ')}`);
  }
  if (len < 100) improvements.push('Too brief, interviewers want to see depth of reasoning (aim for 3–5 sentences minimum)');
  if (sentences < 3 && len >= 100) improvements.push('Break your answer into multiple sentences for easier scanning');
  if (connectorHits === 0 && len >= 150) improvements.push('Use phrases like "first / because / therefore" to signal structure');
  if (!improvements.length) improvements.push('Strong answer. Next time, open with your one-line conclusion for extra punch.');

  return {
    scores: { technical, communication, structure, overall },
    feedback: { strengths, improvements },
    stats: {
      length: len,
      sentences,
      keywordHits: keywordHits.length,
      keywordTotal: keywords.length,
      keyPointsCovered: keyPointsCovered.length,
      keyPointsTotal: keyPoints.length,
    },
  };
}

function clamp(n, lo, hi) {
  const x = Number.isFinite(n) ? n : lo;
  return Math.max(lo, Math.min(hi, x));
}

function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

export function aggregateScores(results) {
  const list = (results || []).filter(Boolean);
  if (!list.length) {
    return { technical: 0, communication: 0, structure: 0, overall: 0 };
  }
  const sum = list.reduce(
    (acc, r) => {
      acc.technical += r.scores.technical;
      acc.communication += r.scores.communication;
      acc.structure += r.scores.structure;
      return acc;
    },
    { technical: 0, communication: 0, structure: 0 }
  );
  const n = list.length;
  const technical = round1(sum.technical / n);
  const communication = round1(sum.communication / n);
  const structure = round1(sum.structure / n);
  const overall = round1((technical + communication + structure) / 3);
  return { technical, communication, structure, overall };
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
