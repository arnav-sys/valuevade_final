// Card-type theme map + bucket helpers extracted from NotesPage.jsx (Step 3, P2).
// Pure constants and a small helper — zero behavior change.

export const CARD_THEME = {
  hook:        { label: 'Hook',         accent: '#FF6AC1', icon: '🎣' },
  concept:     { label: 'Concept',      accent: '#246BFD', icon: '💡' },
  'deep-dive': { label: 'Deep Dive',    accent: '#6A5CFF', icon: '🔬' },
  deep_dive:   { label: 'Deep Dive',    accent: '#6A5CFF', icon: '🔬' },
  example:     { label: 'Real World',   accent: '#246BFD', icon: '📊' },
  'real-world':{ label: 'Real World',   accent: '#246BFD', icon: '📊' },
  formula:     { label: 'Formula',      accent: '#6A5CFF', icon: '🔢' },
  mistake:     { label: 'Mistake',      accent: '#FF6AC1', icon: '⚠️' },
  summary:     { label: 'Summary',      accent: '#6A5CFF', icon: '📋' },
  'study-card':{ label: 'Practice',     accent: '#22C55E', icon: '✅' },
  study_card:  { label: 'Practice',     accent: '#22C55E', icon: '✅' },
};

// Card-type buckets used by the Notes filter chips.
// `study-card` (and its variants) are the Practice bucket; everything else is Lessons.
export const PRACTICE_TYPES = new Set(['study-card', 'study_card']);

export function bucketOf(cardType) {
  const k = String(cardType || '').toLowerCase().trim();
  return PRACTICE_TYPES.has(k) ? 'practice' : 'lessons';
}
