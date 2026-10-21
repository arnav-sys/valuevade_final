import * as THREE from 'three';

const C = { ink: '#02073D', muted: '#777B9C', blue: '#246BFD', violet: '#6A5CFF', line: '#EBE7F6', green: '#0F9D78' };
const text = (ctx, value, x, y, size = 22, color = C.ink, weight = 500) => {
  ctx.font = `${weight} ${size}px sans-serif`; ctx.fillStyle = color; ctx.fillText(value, x, y);
};
const box = (ctx, x, y, w, h, color, radius = 8) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
};

/** Sample screen artwork, not market data or AI-generated results. */
export function makeFinanceTexture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 700;
  const c = canvas.getContext('2d'); box(c, 0, 0, 1024, 700, '#FFFFFF', 24);
  box(c, 0, 0, 1024, 64, '#F7F4FF', 0);
  text(c, 'VALUEVADE', 38, 42, 22, C.ink, 800);
  text(c, 'ANALYST WORKSPACE', 693, 40, 16, C.muted);
  if (kind === 'model') {
    text(c, 'Build the model.', 44, 130, 43, C.ink, 700);
    text(c, 'VALUATION LAB   /   SAMPLE DCF', 44, 173, 18, C.muted);
    const headers = ['Free cash flow', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
    headers.forEach((t, i) => text(c, t, i === 0 ? 44 : 250 + i * 116, 237, 17, C.muted));
    ['Revenue', 'Operating profit', 'Cash flow', 'Present value'].forEach((t, row) => {
      const y = 285 + row * 56; box(c, 30, y - 25, 964, 48, row % 2 ? '#FAF8FF' : '#F0ECFC', 4);
      text(c, t, 44, y + 5, 21, C.ink, 600);
      Array.from({ length: 5 }, (_, i) => text(c, `${(120 + i * 21 - row * 17).toFixed(1)}`, 370 + i * 116, y + 5, 21, C.blue));
    });
    text(c, 'THE STORY BEHIND THE NUMBERS', 44, 570, 17, C.muted);
    c.beginPath(); c.moveTo(45, 651); [[200, 621], [350, 640], [500, 583], [650, 602], [800, 540], [970, 514]].forEach(([x, y]) => c.lineTo(x, y));
    c.strokeStyle = C.green; c.lineWidth = 8; c.stroke();
  } else if (kind === 'research') {
    text(c, 'Find the story.', 44, 140, 49, C.ink, 700);
    text(c, 'EQUITY RESEARCH   /   ANNUAL REPORT', 44, 185, 18, C.muted);
    for (let i = 0; i < 5; i++) box(c, 46, 235 + i * 30, i === 4 ? 660 : 924, 10, C.line, 3);
    box(c, 46, 281, 650, 28, '#E0ECFF', 3);
    text(c, 'Revenue growth · Margins · Cash conversion', 58, 302, 20, C.blue, 600);
    [90, 145, 125, 210, 270, 315].forEach((h, i) => box(c, 72 + i * 148, 665 - h * .72, 80, h * .72, i === 5 ? C.violet : C.blue, 8));
  } else {
    text(c, 'Defend your thinking.', 44, 135, 43, C.ink, 700);
    text(c, 'AI MOCK INTERVIEW   /   PRACTICE', 44, 183, 18, C.muted);
    box(c, 44, 220, 936, 160, '#F0EDFF', 18);
    text(c, 'Why is your valuation different', 76, 280, 32, C.ink, 600);
    text(c, 'from the current market price?', 76, 328, 32, C.ink, 600);
    for (let i = 0; i < 30; i++) { const h = 25 + Math.abs(Math.sin(i * .62)) * 115; box(c, 68 + i * 30, 501 - h / 2, 12, h, i > 14 ? C.violet : C.blue, 6); }
    text(c, 'Structure. Evidence. Confidence.', 44, 641, 28, C.muted, 600);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}