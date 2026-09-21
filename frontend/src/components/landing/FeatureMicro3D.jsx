// FeatureMicro3D, bespoke micro-illustration per Feature card. Picks a
// kind based on the feature's name/icon family, renders an SVG inside a
// CSS-3D-transformed container (`perspective` + `transform-style:
// preserve-3d`). Each kind has its own subtle idle animation and a
// `playful` mode that runs faster while the parent card is hovered.
//
// We use SVG + CSS rather than per-card three.js because instantiating 12
// independent WebGL contexts blows past browser limits (~16 max). SVG with
// CSS preserve-3d gives us bespoke-per-kind cinematic visuals at near-zero
// runtime cost. Each glyph reads as a 3D object, it has depth, rotation,
// and chip layers.

import { useState } from 'react';

const KIND_FROM_TITLE = {
  'Pari': 'brain',
  'AI Tutor': 'brain',
  'Personalised AI Roadmap': 'brain',
  'AI-Proof Your Career': 'shield',
  'Interactive Notes': 'pages',
  'Real-World Simulations': 'candles',
  'Equity': 'candles',
  'Mock Interview': 'mic',
  'Mock Interviews': 'mic',
  'Resume': 'document',
  'NISM': 'trophy',
  'Gamification': 'trophy',
  'XP': 'trophy',
};

function pickKind(title = '') {
  for (const key of Object.keys(KIND_FROM_TITLE)) {
    if (title.toLowerCase().includes(key.toLowerCase())) return KIND_FROM_TITLE[key];
  }
  return 'brain';
}

function GlyphBrain({ fast }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 12px rgba(167,139,250,.55))' }}>
      {/* Outer ring, slow rotation */}
      <g style={{ transformOrigin: '50px 50px', animation: `feat-rot ${fast ? 4 : 12}s linear infinite` }}>
        <circle cx="50" cy="50" r="34" fill="none" stroke="#a78bfa" strokeOpacity="0.45" strokeWidth="0.8" strokeDasharray="2 5" />
      </g>
      {/* Brain cluster, 8 nodes connected */}
      <g style={{ transformOrigin: '50px 50px', animation: `feat-rot-rev ${fast ? 3 : 9}s linear infinite` }}>
        {[
          [50,22],[70,32],[78,52],[68,72],[50,78],[32,72],[22,52],[30,32]
        ].map((p, i) => (
          <g key={i}>
            <line x1="50" y1="50" x2={p[0]} y2={p[1]} stroke="#c4b5fd" strokeOpacity="0.5" strokeWidth="0.8" />
            <circle cx={p[0]} cy={p[1]} r="3.4" fill="#c4b5fd"
                    style={{ animation: `feat-pulse ${1.4 + (i % 3) * 0.3}s ease-in-out infinite alternate` }} />
          </g>
        ))}
        <circle cx="50" cy="50" r="6" fill="#8b5cf6" />
      </g>
    </svg>
  );
}

function GlyphCandles({ fast }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 10px rgba(167,139,250,.55))' }}>
      <line x1="10" y1="78" x2="90" y2="78" stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="0.6" />
      {[
        { x: 22, h: 24, up: true,  d: 0 },
        { x: 40, h: 38, up: false, d: 0.4 },
        { x: 58, h: 48, up: true,  d: 0.8 },
        { x: 76, h: 32, up: false, d: 1.2 },
      ].map((c, i) => (
        <g key={i} style={{ animation: `feat-bob ${fast ? 1.4 : 2.6}s ease-in-out infinite`, animationDelay: `${c.d}s`, transformOrigin: `${c.x}px 78px` }}>
          {/* wick */}
          <line x1={c.x} y1={78 - c.h - 6} x2={c.x} y2={78} stroke="#a78bfa" strokeOpacity="0.5" strokeWidth="0.8" />
          {/* body */}
          <rect x={c.x - 6} y={78 - c.h} width="12" height={c.h} rx="1.5"
                fill={c.up ? '#c4b5fd' : '#7c4ddb'}
                stroke="#a78bfa" strokeWidth="0.4" />
        </g>
      ))}
    </svg>
  );
}

function GlyphMic({ fast }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 12px rgba(167,139,250,.55))' }}>
      {/* halo rings */}
      {[28, 38, 48].map((r, i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none" stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="0.7"
                style={{ animation: `feat-halo ${fast ? 1.4 : 2.8}s ease-out infinite`, animationDelay: `${i * 0.5}s`, transformOrigin: '50px 50px' }} />
      ))}
      {/* mic body */}
      <rect x="42" y="28" width="16" height="30" rx="8" fill="#c4b5fd" />
      <rect x="42" y="28" width="16" height="30" rx="8" fill="none" stroke="#8b5cf6" strokeWidth="0.8" />
      {/* stand */}
      <path d="M34 54 Q50 70 66 54" stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <line x1="50" y1="68" x2="50" y2="80" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="42" y1="80" x2="58" y2="80" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GlyphTrophy({ fast }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 14px rgba(167,139,250,.6))' }}>
      <g style={{ transformOrigin: '50px 50px', animation: `feat-rot ${fast ? 5 : 16}s linear infinite` }}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#a78bfa" strokeOpacity="0.18" strokeWidth="0.7" strokeDasharray="3 4" />
      </g>
      {/* trophy cup */}
      <g style={{ animation: `feat-bob ${fast ? 1.2 : 2.4}s ease-in-out infinite`, transformOrigin: '50px 50px' }}>
        <path d="M32 24 H68 V42 Q68 60 50 60 Q32 60 32 42 Z" fill="#c4b5fd" />
        <path d="M32 24 H68 V42 Q68 60 50 60 Q32 60 32 42 Z" fill="none" stroke="#8b5cf6" strokeWidth="0.8" />
        {/* handles */}
        <path d="M28 28 Q18 30 22 42 Q26 50 32 48" fill="none" stroke="#a78bfa" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M72 28 Q82 30 78 42 Q74 50 68 48" fill="none" stroke="#a78bfa" strokeWidth="1.2" strokeLinecap="round" />
        {/* stand */}
        <rect x="44" y="60" width="12" height="10" fill="#8b5cf6" />
        <rect x="36" y="72" width="28" height="6" rx="1" fill="#a78bfa" />
        {/* star */}
        <polygon points="50,32 53,40 61,40 55,45 57,53 50,48 43,53 45,45 39,40 47,40" fill="#fff7d4" opacity="0.95" />
      </g>
    </svg>
  );
}

function GlyphShield({ fast }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 12px rgba(167,139,250,.55))' }}>
      <g style={{ animation: `feat-bob ${fast ? 1.6 : 3}s ease-in-out infinite`, transformOrigin: '50px 50px' }}>
        <path d="M50 18 L78 30 V52 Q78 72 50 84 Q22 72 22 52 V30 Z" fill="#7c4ddb" opacity="0.55" />
        <path d="M50 18 L78 30 V52 Q78 72 50 84 Q22 72 22 52 V30 Z" fill="none" stroke="#c4b5fd" strokeWidth="1" />
        {/* checkmark */}
        <path d="M38 52 L48 62 L66 42" stroke="#fff7d4" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function GlyphPages({ fast }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 10px rgba(167,139,250,.45))' }}>
      {[0, 1, 2].map((i) => (
        <g key={i} style={{
          animation: `feat-bob ${fast ? 1.6 : 3}s ease-in-out infinite`,
          animationDelay: `${i * 0.3}s`,
          transformOrigin: '50px 50px',
        }}>
          <rect x={26 + i * 6} y={20 + i * 6} width="40" height="48" rx="3"
                fill="#7c4ddb" fillOpacity={0.35 + i * 0.18}
                stroke="#c4b5fd" strokeWidth="0.6" />
          <line x1={32 + i * 6} y1={30 + i * 6} x2={58 + i * 6} y2={30 + i * 6} stroke="#c4b5fd" strokeOpacity="0.5" strokeWidth="0.8" />
          <line x1={32 + i * 6} y1={38 + i * 6} x2={54 + i * 6} y2={38 + i * 6} stroke="#c4b5fd" strokeOpacity="0.5" strokeWidth="0.8" />
          <line x1={32 + i * 6} y1={46 + i * 6} x2={56 + i * 6} y2={46 + i * 6} stroke="#c4b5fd" strokeOpacity="0.5" strokeWidth="0.8" />
        </g>
      ))}
    </svg>
  );
}

function GlyphDocument({ fast }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 10px rgba(167,139,250,.5))' }}>
      <g style={{ animation: `feat-bob ${fast ? 1.4 : 2.6}s ease-in-out infinite`, transformOrigin: '50px 50px' }}>
        <path d="M28 18 H62 L74 30 V82 H28 Z" fill="#7c4ddb" fillOpacity="0.5" stroke="#c4b5fd" strokeWidth="0.8" />
        <path d="M62 18 V30 H74" fill="none" stroke="#c4b5fd" strokeWidth="0.8" />
        {[40, 48, 56, 64, 72].map((y, i) => (
          <line key={i} x1={34} y1={y} x2={i % 2 === 0 ? 66 : 56} y2={y} stroke="#c4b5fd" strokeOpacity="0.5" strokeWidth="0.7" />
        ))}
      </g>
    </svg>
  );
}

const GLYPHS = {
  brain:    GlyphBrain,
  candles:  GlyphCandles,
  mic:      GlyphMic,
  trophy:   GlyphTrophy,
  shield:   GlyphShield,
  pages:    GlyphPages,
  document: GlyphDocument,
};

export default function FeatureMicro3D({ title, hovered = false }) {
  const kind = pickKind(title);
  const Glyph = GLYPHS[kind] || GlyphBrain;
  const [tilt, setTilt] = useState({ rx: -8, ry: 10 });
  return (
    <div
      data-testid={`feature-micro3d-${kind}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        setTilt({ rx: -dy * 14, ry: dx * 14 });
      }}
      onMouseLeave={() => setTilt({ rx: -8, ry: 10 })}
      style={{
        width: '92px', height: '92px', perspective: '600px',
      }}
    >
      <div style={{
        width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: 'transform 280ms cubic-bezier(.22,1,.36,1)',
      }}>
        <Glyph fast={hovered} />
      </div>
      <style>{`
        @keyframes feat-rot      { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes feat-rot-rev  { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes feat-pulse    { 0% { opacity: 0.55; r: 3; } 100% { opacity: 1; r: 3.8; } }
        @keyframes feat-bob      { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes feat-halo     { 0% { opacity: 0.85; transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.4); } }
        @media (prefers-reduced-motion: reduce) {
          [data-testid^="feature-micro3d-"] svg g, [data-testid^="feature-micro3d-"] svg circle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
