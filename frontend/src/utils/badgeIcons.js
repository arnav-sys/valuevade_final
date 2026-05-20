// Maps master_badges.icon_slug values to lucide-react component names.
// Keep this in sync with the seed in 0004_badges_engine.sql.

import {
  GraduationCap,
  Database,
  Calculator,
  BookOpen,
  CheckCircle2,
  Trophy,
  Zap,
  Rocket,
  Timer,
  Sparkles,
  Flag,
  Snowflake,
  Flame,
  Mountain,
  ShieldCheck,
  Beaker,
  Crown,
  UserCheck,
  Compass,
  Moon,
  Sun,
  HeartPulse,
  Award as DefaultIcon,
} from 'lucide-react';

const MAP = {
  'graduation-cap': GraduationCap,
  'database': Database,
  'calculator': Calculator,
  'book-open': BookOpen,
  'check-circle-2': CheckCircle2,
  'trophy': Trophy,
  'zap': Zap,
  'rocket': Rocket,
  'timer': Timer,
  'sparkles': Sparkles,
  'flag': Flag,
  'snowflake': Snowflake,
  'flame': Flame,
  'mountain': Mountain,
  'shield-check': ShieldCheck,
  'beaker': Beaker,
  'crown': Crown,
  'user-check': UserCheck,
  'compass': Compass,
  'moon': Moon,
  'sun': Sun,
  'heart-pulse': HeartPulse,
};

export function iconForSlug(slug) {
  return MAP[slug] || DefaultIcon;
}

export const RARITY_COLORS = {
  common:    { ring: '#9CA3AF', glow: '#9CA3AF66', text: '#9CA3AF' },
  rare:      { ring: '#246BFD', glow: '#246BFD88', text: '#246BFD' },
  epic:      { ring: '#A855F7', glow: '#A855F799', text: '#A855F7' },
  legendary: { ring: '#F59E0B', glow: '#F59E0BAA', text: '#F59E0B' },
};

export function rarityColor(rarity) {
  return RARITY_COLORS[rarity] || RARITY_COLORS.common;
}
