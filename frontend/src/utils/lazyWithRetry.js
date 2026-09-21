import { lazy } from 'react';

/**
 * Wraps React.lazy with chunk-reload recovery.
 *
 * After a deploy, JS chunk filenames change (different hashes) so a tab that
 * still has the old index.html will throw `ChunkLoadError: Loading chunk N failed`
 * the moment the user navigates to a lazy-loaded route. We detect that, do ONE
 * hard reload to pick up the fresh index.html + new chunk filenames, and use a
 * sessionStorage flag to make sure we don't reload-loop if the failure is real.
 */
const RELOAD_FLAG = 'vv-chunk-reloaded';

export const isChunkLoadError = (err) => {
  if (!err) return false;
  const msg = String(err.message || err);
  return (
    err.name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Loading CSS chunk [\w-]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
};

const lazyWithRetry = (factory) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err)) {
        const alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG);
        if (!alreadyReloaded) {
          window.sessionStorage.setItem(RELOAD_FLAG, '1');
          // Force a hard reload to pick up the new index.html with fresh chunk hashes.
          window.location.reload();
          // Return a never-resolving placeholder so React doesn't render the error
          // boundary in the brief instant before the page actually reloads.
          return new Promise(() => {});
        }
        // Second failure within the same session, clear the flag for next session and bubble.
        window.sessionStorage.removeItem(RELOAD_FLAG);
      }
      throw err;
    }
  });

export default lazyWithRetry;
