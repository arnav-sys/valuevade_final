import StreakMilestoneOverlay from './StreakMilestoneOverlay';
import ShameCard from './ShameCard';

/**
 * Mount-once root for streak-driven overlays.  Placed inside StreakProvider
 * in App.js so the milestone overlay and shame card surface anywhere the
 * streak engine fires them.
 */
export default function StreakRoot() {
  return (
    <>
      <StreakMilestoneOverlay />
      <ShameCard />
    </>
  );
}
