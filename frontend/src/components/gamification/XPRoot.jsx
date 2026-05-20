import LevelUpOverlay from './LevelUpOverlay';
import XPGainParticle from './XPGainParticle';

/**
 * Mount-once root that hosts the level-up overlay and the floating XP
 * particle. Placed inside XPProvider in App.js so any awardXP call from
 * anywhere in the tree will surface here.
 */
export default function XPRoot() {
  return (
    <>
      <LevelUpOverlay />
      <XPGainParticle />
    </>
  );
}
