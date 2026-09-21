import { useEffect, useRef } from 'react';

/* Canvas 2D candlestick chart: seeded series, 20-period MA, volume bars,
 * live last candle, crosshair. Purely illustrative market data. */

const N = 64;
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function genCandles(n, start, seed) {
  const rnd = seeded(seed);
  const out = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o * (1 + 0.0012 + (rnd() - 0.5) * 0.03);
    const h = Math.max(o, c) * (1 + rnd() * 0.008);
    const l = Math.min(o, c) * (1 - rnd() * 0.008);
    out.push({ o, h, l, c, v: 0.35 + rnd() * 0.95 });
    p = c;
  }
  return out;
}

const fmt = (n) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function MarketChartCanvas({ light, onPrice, className }) {
  const ref = useRef(null);
  const onPriceRef = useRef(onPrice);
  onPriceRef.current = onPrice;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const candles = genCandles(N, 2610, 20260616);
    const rnd = seeded(99);
    let target = candles[N - 1].c;
    let lastSwitch = performance.now();
    let lastPush = performance.now();
    let lastEmit = 0;
    let pointer = null;
    let raf = 0;
    let w = 0; let h = 0; let dpr = 1;

    const ink = light ? '#141414' : '#F2EFE8';
    const faint = light ? 'rgba(20,20,20,0.42)' : 'rgba(242,239,232,0.42)';
    const hair = light ? 'rgba(20,20,20,0.10)' : 'rgba(242,239,232,0.12)';
    const blue = light ? '#246BFD' : '#4C86FF';
    const green = light ? '#0F9960' : '#26D07C';
    const red = light ? '#DB3737' : '#F85149';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { pointer = null; };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);

    const draw = (now) => {
      // live last candle
      const last = candles[N - 1];
      if (!reduce) {
        if (now - lastSwitch > 1400) { target = last.o * (1 + (rnd() - 0.48) * 0.02); lastSwitch = now; }
        last.c += (target - last.c) * 0.06;
        last.h = Math.max(last.h, last.c); last.l = Math.min(last.l, last.c);
        if (now - lastPush > 7000) {
          const o = last.c;
          candles.shift();
          candles.push({ o, c: o, h: o, l: o, v: 0.4 + rnd() * 0.8 });
          lastPush = now;
        }
      }
      if (now - lastEmit > 220 && onPriceRef.current) {
        onPriceRef.current(candles[N - 1].c, candles[N - 2].c);
        lastEmit = now;
      }

      ctx.clearRect(0, 0, w, h);
      const padR = 58; const padT = 12; const padB = 22;
      const volH = Math.round((h - padT - padB) * 0.16);
      const plotW = w - padR; const plotH = h - padT - padB - volH - 6;
      let lo = Infinity; let hi = -Infinity; let vmax = 0;
      candles.forEach((c) => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); vmax = Math.max(vmax, c.v); });
      const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
      const y = (p) => padT + (1 - (p - lo) / (hi - lo)) * plotH;
      const step = plotW / N; const cw = Math.max(2, step * 0.58);

      // grid + axis
      ctx.font = `10px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const p = lo + ((hi - lo) * i) / 4; const yy = y(p);
        ctx.strokeStyle = hair; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke();
        ctx.fillStyle = faint; ctx.fillText(fmt(p), plotW + 8, yy);
      }
      // time labels
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const today = new Date();
      for (let i = 4; i < N; i += 14) {
        const d = new Date(today); d.setDate(d.getDate() - (N - 1 - i));
        ctx.fillStyle = faint;
        ctx.fillText(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), i * step + step / 2, h - 6);
      }
      // volume
      candles.forEach((c, i) => {
        const x = i * step + (step - cw) / 2;
        const vh = (c.v / vmax) * volH;
        ctx.fillStyle = c.c >= c.o ? green : red;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x, padT + plotH + 6 + (volH - vh), cw, vh);
        ctx.globalAlpha = 1;
      });
      // candles
      candles.forEach((c, i) => {
        const x = i * step + step / 2; const up = c.c >= c.o;
        ctx.strokeStyle = up ? green : red; ctx.fillStyle = up ? green : red; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y(c.h)); ctx.lineTo(x, y(c.l)); ctx.stroke();
        const top = y(Math.max(c.o, c.c)); const bh = Math.max(1, Math.abs(y(c.o) - y(c.c)));
        if (up && light) { ctx.fillStyle = light ? '#FBF9F5' : '#0F141C'; ctx.fillRect(x - cw / 2, top, cw, bh); ctx.strokeRect(x - cw / 2 + 0.5, top + 0.5, cw - 1, bh - 1); }
        else ctx.fillRect(x - cw / 2, top, cw, bh);
      });
      // MA20
      ctx.strokeStyle = blue; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 19; i < N; i++) {
        let s = 0; for (let k = i - 19; k <= i; k++) s += candles[k].c;
        const xx = i * step + step / 2; const yy = y(s / 20);
        if (i === 19) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      // last price line + tag
      const lp = candles[N - 1].c; const ly = y(lp);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = blue; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(plotW, ly); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = blue; ctx.fillRect(plotW + 3, ly - 8, padR - 6, 16);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(lp), plotW + 8, ly);
      // crosshair
      if (pointer && pointer.x < plotW) {
        const i = Math.min(N - 1, Math.max(0, Math.floor(pointer.x / step)));
        const cx = i * step + step / 2; const c = candles[i];
        ctx.setLineDash([2, 4]); ctx.strokeStyle = faint; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, padT + plotH + volH + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, pointer.y); ctx.lineTo(plotW, pointer.y); ctx.stroke();
        ctx.setLineDash([]);
        const label = `O ${fmt(c.o)}  H ${fmt(c.h)}  L ${fmt(c.l)}  C ${fmt(c.c)}`;
        ctx.font = `10.5px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const tw = ctx.measureText(label).width + 12;
        const lx = Math.min(Math.max(6, cx - tw / 2), plotW - tw - 4);
        ctx.fillStyle = ink; ctx.fillRect(lx, padT, tw, 18);
        ctx.fillStyle = light ? '#FBF9F5' : '#0F141C'; ctx.fillText(label, lx + 6, padT + 4);
        ctx.font = `10px ${MONO}`;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [light]);

  return <canvas ref={ref} className={className} data-testid="hero-market-chart" aria-label="Illustrative candlestick chart" role="img" />;
}
