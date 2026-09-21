import { Fragment, useState, useCallback } from 'react';
import MarketChartCanvas from '@/components/landing/MarketChartCanvas';

/* Hero "market desk": live chart header + candlestick canvas + a small DCF
 * sensitivity block. All figures are illustrative. */

const WACC = [0.095, 0.105, 0.115];
const G = [0.025, 0.035, 0.045];
const FCF = 217;
const price = (w, g) => Math.round((FCF * (1 + g)) / (w - g));
const inr = (n) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const pct = (x) => `${(x * 100).toFixed(1)}%`;

export default function MarketDeskPanel({ light }) {
  const [live, setLive] = useState({ p: 2845.5, prev: 2793.8 });
  const [cell, setCell] = useState({ w: 1, g: 1 });
  const onPrice = useCallback((p, prev) => setLive({ p, prev }), []);

  const chg = ((live.p - live.prev) / live.prev) * 100;
  const up = chg >= 0;
  const target = price(WACC[cell.w], G[cell.g]);

  return (
    <div className="lv-desk" data-testid="hero-market-visual-card">
      <div className="lv-desk__head">
        <div>
          <div className="lv-folio" style={{ color: 'var(--color-text-muted)' }}>RELIANCE · NSE · Illustrative</div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="lv-serif text-[30px] leading-none" data-testid="hero-live-price">
              ₹{live.p.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="lv-desk__chip" style={{ background: up ? 'var(--lv-green)' : 'var(--lv-red)' }}>
              {up ? '+' : ''}{chg.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 lv-folio" style={{ color: 'var(--lv-green)' }}>
            <span className="lv-live-dot" /> live
          </div>
          <div className="flex gap-1">
            {['1D', '1W', '1M', '1Y'].map((t) => (
              <span key={t} className={`lv-desk__tab ${t === '1M' ? 'lv-desk__tab--on' : ''}`}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <MarketChartCanvas light={light} onPrice={onPrice} className="block w-full h-[220px] sm:h-[250px]" />

      <div className="lv-desk__foot">
        <div>
          <div className="lv-folio mb-2">DCF · Sensitivity</div>
          <div className="lv-dcf-row"><span>WACC</span><span>{pct(WACC[cell.w])}</span></div>
          <div className="lv-dcf-row"><span>Terminal growth</span><span>{pct(G[cell.g])}</span></div>
          <div className="lv-dcf-row"><span>Implied EV</span><span>₹{inr(Math.round(target * 676.4 / 100))} Cr</span></div>
          <div className="lv-dcf-row">
            <span>Target price</span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }} data-testid="hero-dcf-target">₹{inr(target)}</span>
          </div>
        </div>
        <div className="lv-sens" data-testid="hero-dcf-sensitivity">
          <div className="lv-sens__h">w \ g</div>
          {G.map((g) => <div key={g} className="lv-sens__h">{pct(g)}</div>)}
          {WACC.map((w, wi) => (
            <Fragment key={w}>
              <div className="lv-sens__h">{pct(w)}</div>
              {G.map((g, gi) => (
                <div
                  key={`${w}${g}`}
                  className={`lv-sens__c ${wi === cell.w && gi === cell.g ? 'lv-sens__c--on' : ''}`}
                  onMouseEnter={() => setCell({ w: wi, g: gi })}
                  data-testid={`hero-dcf-cell-${wi}-${gi}`}
                >
                  {inr(price(w, g))}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
