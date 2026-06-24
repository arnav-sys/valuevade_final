// CustomCursor — landing-only violet cursor with a soft trail and click
// ripple. Disabled on touch devices and when prefers-reduced-motion is set.
//
// Architecture:
//   • Hot inner dot (high opacity) follows the mouse 1:1 (no lerp).
//   • Soft outer ring lerps toward the dot at 0.12 (existing behavior).
//   • TRAIL: an N-element array of div refs; each frame the array stores the
//     last N cursor positions, oldest-first; render each div at the
//     corresponding stale position with progressively lower opacity + size.
//   • CLICK RIPPLE: on mousedown spawn a short-lived expanding ring at the
//     click coordinates. Ring removes itself on animationend.

import { useEffect, useRef } from 'react';

const TRAIL_LEN = 10;

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const trailRefs = useRef([]);
  const pos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  // Circular buffer of recent cursor positions.
  const history = useRef(Array.from({ length: TRAIL_LEN }, () => ({ x: -100, y: -100 })));
  const animFrameId = useRef(null);

  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) return undefined;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.body.classList.add('custom-cursor');

    const handleMouseMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.left = `${e.clientX}px`;
        dotRef.current.style.top  = `${e.clientY}px`;
      }
    };

    const handleClick = (e) => {
      if (reduced) return;
      const ripple = document.createElement('div');
      ripple.className = 'cursor-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top  = `${e.clientY}px`;
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      document.body.appendChild(ripple);
    };

    const animate = () => {
      ringPos.current.x += (pos.current.x - ringPos.current.x) * 0.12;
      ringPos.current.y += (pos.current.y - ringPos.current.y) * 0.12;
      if (ringRef.current) {
        ringRef.current.style.left = `${ringPos.current.x}px`;
        ringRef.current.style.top  = `${ringPos.current.y}px`;
      }
      if (!reduced) {
        // Shift history right (newest at index 0), then position each trail dot.
        history.current.pop();
        history.current.unshift({ x: pos.current.x, y: pos.current.y });
        for (let i = 0; i < TRAIL_LEN; i++) {
          const ref = trailRefs.current[i];
          if (!ref) continue;
          const p = history.current[i];
          ref.style.left = `${p.x}px`;
          ref.style.top  = `${p.y}px`;
        }
      }
      animFrameId.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleClick);
    animFrameId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleClick);
      cancelAnimationFrame(animFrameId.current);
      document.body.classList.remove('custom-cursor');
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" data-testid="custom-cursor-dot" />
      <div ref={ringRef} className="cursor-ring" data-testid="custom-cursor-ring" />
      {Array.from({ length: TRAIL_LEN }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { trailRefs.current[i] = el; }}
          className="cursor-trail-dot"
          data-testid={`cursor-trail-${i}`}
          style={{
            // Oldest dots (high i) shrink + dim; newest (low i) closer to ring.
            width:   `${Math.max(2, 7 - i * 0.5)}px`,
            height:  `${Math.max(2, 7 - i * 0.5)}px`,
            opacity: Math.max(0.04, 0.42 - i * 0.04),
          }}
        />
      ))}
    </>
  );
}
