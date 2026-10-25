# Enterprise landing QA follow-up — 2026-10-25

## Reported fallback concern
Iteration 103 reported no bitmap fallback under a WebGL-block probe. A deterministic
main-agent reproduction overrode `HTMLCanvasElement.prototype.getContext` for **webgl,
webgl2 and experimental-webgl**, preserving 2D textures. Both hero/workbench fallbacks
appeared and no hero canvas mounted even before the follow-up patch. The original
reported failure was not reproduced when both WebGL versions were actually blocked.

## Defensive hardening implemented
- Validate `renderer.getContext()`, `isContextLost()` and MAX_TEXTURE_SIZE after construction.
- Cancel animation and show a bitmap if rendering throws or a graphics context is lost.
- Disable 3D-only controls when using a static bitmap fallback.

## Verified after changes
- Normal agent hero canvas renders and successive frames differ.
- Triggering real `WEBGL_lose_context.loseContext()` displays a fully loaded fallback;
  pause control disabled.
- Reduced-motion preference renders a static scene; data-paused=true and frame images equal.
- Fully blocked WebGL: both agent fallback images present, zero new scene canvases.
- Course tab switch also loads a fallback at390px.
- Desktop1920x800 and mobile390x844 screenshot checks: horizontal overflow [].

Original tabs/content/form/responsiveness/regression verification and 18 passing backend
tests remain recorded in iteration_103.json. No runtime APIs mocked. Existing resources
503 is the known schema-setup state, not a redesign regression; automated email and
paid-resource E2E remain pending the previously documented setup.