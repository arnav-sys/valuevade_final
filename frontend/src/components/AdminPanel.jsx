import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';

// ── Admin tab components ──────────────────────────────────────────────────────
import WaitlistTab from './admin/WaitlistTab';
import UsersTab, { ProgressModal } from './admin/UsersTab';
import PaymentsTab from './admin/PaymentsTab';
import CurriculumTab from './admin/CurriculumTab';
import CoursesTab from './admin/CoursesTab';
import ErrorsTab from './admin/ErrorsTab';
import MockInterviewsTab from './admin/MockInterviewsTab';
import FreeTrialsTab from './admin/FreeTrialsTab';
import LinkedInClaimsTab from './admin/LinkedInClaimsTab';
import RewardsTab from './admin/RewardsTab';
import SessionVideosTab from './admin/SessionVideosTab';
import FaqsTab from './admin/FaqsTab';
import FacultyTab from './admin/FacultyTab';
import TestimonialsTab from './admin/TestimonialsTab';
import CustomizationTab from './admin/CustomizationTab';
import SessionFeedbackTab from './admin/SessionFeedbackTab';

import {
  Users, ListChecks, BookOpen, RefreshCw,
  CreditCard, Video, Loader2, GraduationCap,
  AlertTriangle, Link2, HelpCircle, Sparkles,
  MessageSquareWarning, Gift, Download, Building2,
  Mail, FolderOpen,
} from 'lucide-react';

const ADMIN_EMAIL = 'info@valuevade.com';

function AdminTabs({ tab, setTab }) {
  const tabs = [
    { k: 'waitlist',      label: 'Waitlist Signups',   icon: ListChecks },
    { k: 'users',         label: 'Enrolled Users',     icon: Users },
    { k: 'progress',      label: 'Per-User Progress',  icon: BookOpen },
    { k: 'payments',      label: 'Payments',           icon: CreditCard },
    { k: 'videos',        label: 'Session Videos',     icon: Video },
    { k: 'courses',       label: 'Courses',            icon: FolderOpen },
    { k: 'curriculum',    label: 'View Course',        icon: GraduationCap },
    { k: 'mock',          label: 'Mock Interviews',    icon: Building2 },
    { k: 'trials',        label: 'Free Trials',        icon: Mail },
    { k: 'customization', label: 'AI Customisation',  icon: Sparkles },
    { k: 'feedback',      label: 'Session Feedback',  icon: MessageSquareWarning },
    { k: 'faqs',          label: 'FAQs',               icon: HelpCircle },
    { k: 'faculty',       label: 'Faculty',            icon: GraduationCap },
    { k: 'testimonials',  label: 'Testimonials',       icon: MessageSquareWarning },
    { k: 'rewards',       label: 'Rewards',            icon: Gift },
    { k: 'claims',        label: 'LinkedIn Claims',    icon: Link2 },
    { k: 'errors',        label: 'Errors',             icon: AlertTriangle },
  ];
  return (
    <div className="flex gap-2 mb-6 border-b border-[var(--color-border)] flex-wrap" data-testid="admin-tabs">
      {tabs.map(({ k, label, icon: Icon }) => (
        <button
          key={k}
          data-testid={`admin-tab-${k}`}
          onClick={() => setTab(k)}
          className={`px-4 py-3 flex items-center gap-2 font-medium border-b-2 transition-colors ${
            tab === k
              ? 'border-[var(--color-primary)] text-[var(--color-text)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Icon className="w-4 h-4" /> {label}
        </button>
      ))}
    </div>
  );
}

export default function AdminPanel() {
  const { user, profile, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'waitlist');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setParams({ tab }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auth state is async, wait for it before deciding to redirect.
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const email = (user?.email || profile?.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" data-testid="admin-denied">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Admin access required.</h1>
          <p className="text-[var(--color-text-muted)] mb-4">
            Your account ({email || 'unknown'}) is not authorized for the admin panel.
          </p>
          <a href="/dashboard" className="text-[var(--color-primary)] hover:underline">← Back to dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-[var(--color-text)] font-bricolage">Admin Panel</h1>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1"
              data-testid="admin-refresh"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Logged in as <strong>{email}</strong>.</p>

          <AdminTabs tab={tab} setTab={setTab} />

          {tab === 'waitlist'      && <WaitlistTab />}
          {tab === 'users'         && <UsersTab onSelect={(u) => { setSelected(u); }} />}
          {tab === 'progress'      && <UsersTab onSelect={setSelected} />}
          {tab === 'payments'      && <PaymentsTab />}
          {tab === 'videos'        && <SessionVideosTab />}
          {tab === 'faqs'          && <FaqsTab />}
          {tab === 'faculty'       && <FacultyTab />}
          {tab === 'testimonials'  && <TestimonialsTab />}
          {tab === 'customization' && <CustomizationTab />}
          {tab === 'feedback'      && <SessionFeedbackTab />}
          {tab === 'curriculum'    && <CurriculumTab />}
          {tab === 'courses'       && <CoursesTab />}
          {tab === 'mock'          && <MockInterviewsTab />}
          {tab === 'trials'        && <FreeTrialsTab />}
          {tab === 'rewards'       && <RewardsTab />}
          {tab === 'claims'        && <LinkedInClaimsTab />}
          {tab === 'errors'        && <ErrorsTab />}
        </div>

        <ProgressModal user={selected} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
}
