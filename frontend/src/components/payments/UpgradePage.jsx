import Sidebar from '../Sidebar';
import PricingCards from './PricingCards';

export default function UpgradePage() {
  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto" data-testid="upgrade-page">
          <h1 className="text-4xl font-bold text-[var(--color-text)] font-bricolage mb-2">
            Unlock lifetime access.
          </h1>
          <p className="text-lg text-[var(--color-text-muted)] mb-8">
            One-time payment, all 15+ modules, 68 finance simulations, AI tutor &amp; mock-interview capstone.
          </p>
          <PricingCards />
        </div>
      </main>
    </div>
  );
}
