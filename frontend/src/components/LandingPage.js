import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, ArrowRight } from 'lucide-react';
import CustomCursor from '@/components/CustomCursor';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import ProblemSection from '@/components/ProblemSection';
import FeaturesSection from '@/components/FeaturesSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import AIProofSection from '@/components/AIProofSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import FinalCTASection from '@/components/FinalCTASection';
import Footer from '@/components/Footer';
import WaitlistConfirmation from '@/components/WaitlistConfirmation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LandingPage() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [waitlistData, setWaitlistData] = useState(null);
  const [showMobileBar, setShowMobileBar] = useState(true);
  const [refCode, setRefCode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setRefCode(ref);
  }, []);

  const scrollToWaitlist = () => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleWaitlistSubmit = async (firstName, email) => {
    const payload = { first_name: firstName, email };
    if (refCode) payload.ref_code = refCode;
    const res = await axios.post(`${API}/waitlist`, payload);
    setWaitlistData(res.data);
    setShowConfirmation(true);
    window.scrollTo(0, 0);
  };

  if (showConfirmation) {
    return (
      <>
        <CustomCursor />
        <WaitlistConfirmation data={waitlistData} />
      </>
    );
  }

  return (
    <div className="bg-[var(--bg-primary)] min-h-screen" data-testid="landing-page">
      <CustomCursor />
      <Navbar onJoinWaitlist={scrollToWaitlist} />

      <main>
        <HeroSection onJoinWaitlist={scrollToWaitlist} />
        <ProblemSection />
        <FeaturesSection />
        <HowItWorksSection />
        <AIProofSection />
        <TestimonialsSection />
        <FinalCTASection onSubmit={handleWaitlistSubmit} />
      </main>

      <Footer />

      {showMobileBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden mobile-sticky-bar"
          data-testid="mobile-sticky-bar"
        >
          <div className="bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
            <p className="text-[var(--color-text-muted)] text-sm font-bricolage flex-1">
              Join 500+ students
            </p>
            <button
              onClick={scrollToWaitlist}
              className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-full flex items-center gap-1.5"
              data-testid="mobile-bar-cta"
            >
              Claim your spot <ArrowRight size={14} />
            </button>
            <button
              onClick={() => setShowMobileBar(false)}
              className="ml-2 text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
              data-testid="mobile-bar-dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
