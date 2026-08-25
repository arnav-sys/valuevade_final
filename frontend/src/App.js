import "@/App.css";
import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import { HelmetProvider } from "react-helmet-async";
import { installErrorReporter } from "@/lib/errorReporter";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XPProvider } from "@/contexts/XPContext";
import { SoundProvider } from "@/contexts/SoundContext";
import { StreakProvider } from "@/contexts/StreakContext";
import { BadgeProvider } from "@/contexts/BadgeContext";
import { DailyChallengesProvider } from "@/contexts/DailyChallengesContext";
import { TutorProvider } from "@/contexts/TutorContext";
import { DoubtsLauncherProvider } from "@/contexts/DoubtsLauncherContext";
import { OpenDoubtsProvider } from "@/contexts/OpenDoubtsContext";
import { MilestonesProvider } from "@/contexts/MilestonesContext";
import XPRoot from "@/components/gamification/XPRoot";
import StreakRoot from "@/components/gamification/StreakRoot";
import BadgeRoot from "@/components/gamification/BadgeRoot";
import DailyChampionRoot from "@/components/gamification/DailyChampionRoot";
import MilestoneCelebrationOverlay from "@/components/gamification/MilestoneCelebrationOverlay";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublicOnlyRoute from "@/components/PublicOnlyRoute";
import EnrollmentGuard from "@/components/EnrollmentGuard";
import SessionPhaseGuard from "@/components/SessionPhaseGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import BugReportButton from "@/components/BugReportButton";
import RouteLoader from "@/components/RouteLoader";
import PageTransition from "@/components/PageTransition";
import lazyWithRetry from "@/utils/lazyWithRetry";

// Public (eager-load: small, fast, frequent entry points)
import LandingPage from "@/components/LandingPage";
import SignupPage from "@/components/SignupPage";
import LoginPage from "@/components/LoginPage";
import AdminDashboard from "@/components/AdminDashboard";
import NotFoundPage from "@/components/NotFoundPage";

// Authenticated — lazy loaded for faster initial bundle
const EnrollmentPage = lazyWithRetry(() => import("@/components/EnrollmentPage"));
const CoursesPage = lazyWithRetry(() => import("@/components/CoursesPage"));
const CourseDetailsPage = lazyWithRetry(() => import("@/components/CourseDetailsPage"));
const CustomizePage = lazyWithRetry(() => import("@/components/CustomizePage"));
const PreviewPage = lazyWithRetry(() => import("@/components/PreviewPage"));
const ConfirmPage = lazyWithRetry(() => import("@/components/ConfirmPage"));
const LoadingPage = lazyWithRetry(() => import("@/components/LoadingPage"));
const EnrolledPage = lazyWithRetry(() => import("@/components/EnrolledPage"));
const DashboardPage = lazyWithRetry(() => import("@/components/DashboardPage"));
const SessionStartPage = lazyWithRetry(() => import("@/components/SessionStartPage"));
const NotesPage = lazyWithRetry(() => import("@/components/NotesPage"));
const NotesCompletePage = lazyWithRetry(() => import("@/components/NotesCompletePage"));
const QuizStartPage = lazyWithRetry(() => import("@/components/QuizStartPage"));
const QuizPage = lazyWithRetry(() => import("@/components/QuizPage"));
const QuizCompletePage = lazyWithRetry(() => import("@/components/QuizCompletePage"));
const InterviewStartPage = lazyWithRetry(() => import("@/components/InterviewStartPage"));
const InterviewPage = lazyWithRetry(() => import("@/components/InterviewPage"));
const InterviewCompletePage = lazyWithRetry(() => import("@/components/InterviewCompletePage"));
const SimulationStartPage = lazyWithRetry(() => import("@/components/SimulationStartPage"));
const SimulationPage = lazyWithRetry(() => import("@/components/SimulationPage"));
const SimulationCompletePage = lazyWithRetry(() => import("@/components/SimulationCompletePage"));
const SessionCompletePage = lazyWithRetry(() => import("@/components/SessionCompletePage"));
const ModuleProjectStartPage = lazyWithRetry(() => import("@/components/ModuleProjectStartPage"));
const ModuleProjectTasksPage = lazyWithRetry(() => import("@/components/ModuleProjectTasksPage"));
const ModuleProjectCompletePage = lazyWithRetry(() => import("@/components/ModuleProjectCompletePage"));
const CapstoneStartPage = lazyWithRetry(() => import("@/components/CapstoneStartPage"));
const CapstonesListPage = lazyWithRetry(() => import("@/components/CapstonesListPage"));
const CapstoneTasksPage = lazyWithRetry(() => import("@/components/CapstoneTasksPage"));
const CapstoneCompletePage = lazyWithRetry(() => import("@/components/CapstoneCompletePage"));
const ProfilePage = lazyWithRetry(() => import("@/components/ProfilePage"));
const JourneyPage = lazyWithRetry(() => import("@/components/JourneyPage"));
const SettingsPage = lazyWithRetry(() => import("@/components/SettingsPage"));
const PortfolioPage = lazyWithRetry(() => import("@/components/PortfolioPage"));
const PublicPortfolioPage = lazyWithRetry(() => import("@/components/PublicPortfolioPage"));
const ReviewNotesPage = lazyWithRetry(() => import("@/components/ReviewNotesPage"));
const DoubtsPage = lazyWithRetry(() => import("@/components/DoubtsPage"));
const AdminPanel = lazyWithRetry(() => import("@/components/AdminPanel"));
const MockInterviewPage = lazyWithRetry(() => import("@/components/mock-interview/MockInterviewPage"));
const MockInterviewResults = lazyWithRetry(() => import("@/components/mock-interview/MockInterviewResults"));
const InterviewSimHub = lazyWithRetry(() => import("@/components/interview-sim/InterviewSimHub"));
const InterviewSimPlayer = lazyWithRetry(() => import("@/components/interview-sim/InterviewSimPlayer"));
const M3SamplePreview = lazyWithRetry(() => import("@/components/M3SamplePreview"));
const CourseCompletePage = lazyWithRetry(() => import("@/components/CourseCompletePage"));
const DevSimPreview = lazyWithRetry(() => import("@/components/DevSimPreview"));
const M3DryRunPreview = lazyWithRetry(() => import("@/components/M3DryRunPreview"));
const UpgradePage = lazyWithRetry(() => import("@/components/payments/UpgradePage"));
const FreeTrialPlayerPage = lazyWithRetry(() => import("@/components/FreeTrialPlayerPage"));
const MyOrdersPage = lazyWithRetry(() => import("@/components/payments/MyOrdersPage"));
const EnrollmentChoicePage = lazyWithRetry(() => import("@/components/payments/EnrollmentChoicePage"));
// Legal pages — public, DRAFT copy pending founder review (Prompt-4 rebuild).
const PrivacyPolicyPage = lazyWithRetry(() => import("@/components/legal/PrivacyPolicyPage"));
const TermsPage = lazyWithRetry(() => import("@/components/legal/TermsPage"));
const RefundPolicyPage = lazyWithRetry(() => import("@/components/legal/RefundPolicyPage"));
import SessionPaymentGate from "@/components/payments/SessionPaymentGate";
import EnrollmentGate from "@/components/payments/EnrollmentGate";

/** Wraps a learning route in auth + enrollment guards. */
const Learning = ({ children }) => (
  <ProtectedRoute>
    <EnrollmentGuard>
      <SessionPaymentGate>{children}</SessionPaymentGate>
    </EnrollmentGuard>
  </ProtectedRoute>
);

/** Wraps a session phase route with phase-ordering guard. */
const SessionPhase = ({ phase, children }) => (
  <Learning>
    <SessionPhaseGuard phase={phase}>{children}</SessionPhaseGuard>
  </Learning>
);

// Feb 2026 — session-level interview phase disabled. Any legacy URL under
// /session/:sessionId/interview[...] is redirected to that same session's
// simulation-start route. Uses useParams() because a plain
// `<Navigate to="../simulation/start" />` in a flat top-level route walks
// up to `/` (not up one URL segment) and would strip the sessionId → 404.
const InterviewToSimulation = () => {
  const { sessionId } = useParams();
  return <Navigate to={`/session/${sessionId}/simulation/start`} replace />;
};

// Install global error / unhandled-rejection reporters at module load. The
// reporter is idempotent and cannot throw, so it's safe to run before render.
installErrorReporter();

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SoundProvider>
              <XPProvider>
                <StreakProvider>
                <BadgeProvider>
                <DailyChallengesProvider>
                <TutorProvider>
                <DoubtsLauncherProvider>
                <OpenDoubtsProvider>
                <MilestonesProvider>
                <Toaster
                  richColors
                  position="bottom-right"
                  duration={2200}
                  closeButton={false}
                  toastOptions={{
                    style: {
                      background: 'var(--glass-bg)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--color-text)',
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                    },
                  }}
                />
                <XPRoot />
                <StreakRoot />
                <BadgeRoot />
                <DailyChampionRoot />
                <MilestoneCelebrationOverlay />
                <BugReportButton />
                <Suspense fallback={<RouteLoader />}>
              <PageTransition>
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/free-trial/:trialId" element={<FreeTrialPlayerPage />} />
                  <Route path="/m3-sample-preview" element={<M3SamplePreview />} />
                  <Route path="/m3-dryrun-preview" element={<M3DryRunPreview />} />
                  <Route path="/_dev/sim/:simId" element={<DevSimPreview />} />
                  <Route path="/_dev/sim/session/:sessionId" element={<DevSimPreview />} />
                  <Route path="/course-complete" element={<ProtectedRoute><CourseCompletePage /></ProtectedRoute>} />
                  {/* Signup UI removed — existing users can still log in.
                      Any old /signup, /signuproute1 links land on /login. */}
                  <Route path="/signup" element={<Navigate to="/login" replace />} />
                  <Route path="/signuproute1" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                  <Route path="/referral" element={<AdminDashboard />} />
                  <Route path="/waitlist-arnav" element={<AdminDashboard />} />

                  {/* Public portfolio share (no auth) */}
                  <Route path="/p/:slug" element={<PublicPortfolioPage />} />

                  {/* Browsing / enrollment (auth only, no enrollment required) */}
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/course/:courseId" element={<CourseDetailsPage />} />
                  {/* Public legal pages */}
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/refund-policy" element={<RefundPolicyPage />} />
                  {/* Proper enrollment page — preview + confirm, no AI customization */}
                  <Route path="/enroll/:courseId" element={<ProtectedRoute><EnrollmentPage /></ProtectedRoute>} />
                  {/* AI customisation wizard (admin-toggleable via
                      app_settings.ai_customization_mode). Available as an
                      optional flow when mode = 'optional', mandatory when
                      mode = 'mandatory'. */}
                  <Route path="/course/:courseId/customize" element={<ProtectedRoute><CustomizePage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/preview" element={<ProtectedRoute><PreviewPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/confirm" element={<ProtectedRoute><ConfirmPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/loading" element={<ProtectedRoute><LoadingPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/enrolled" element={<ProtectedRoute><EnrolledPage /></ProtectedRoute>} />

                  {/* Account (auth only) */}
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
                  <Route path="/review" element={<ProtectedRoute><ReviewNotesPage /></ProtectedRoute>} />
                  <Route path="/doubts" element={<ProtectedRoute><DoubtsPage /></ProtectedRoute>} />
                  <Route path="/journey" element={<ProtectedRoute><JourneyPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

                  {/* Learning (auth + enrollment required) */}
                  <Route path="/dashboard" element={<Learning><DashboardPage /></Learning>} />

                  <Route path="/session/:sessionId/start" element={<Learning><SessionStartPage /></Learning>} />
                  <Route path="/session/:sessionId/notes" element={<Learning><NotesPage /></Learning>} />
                  <Route path="/session/:sessionId/notes/complete" element={<Learning><NotesCompletePage /></Learning>} />

                  <Route path="/session/:sessionId/quiz/start" element={<SessionPhase phase="quiz"><QuizStartPage /></SessionPhase>} />
                  <Route path="/session/:sessionId/quiz" element={<SessionPhase phase="quiz"><QuizPage /></SessionPhase>} />
                  <Route path="/session/:sessionId/quiz/complete" element={<Learning><QuizCompletePage /></Learning>} />

                  {/* Feb 2026 — session-level interview phase disabled to
                    cut per-user AI cost by ~40%. Old URLs redirect forward
                    to simulation so no bookmark 404s. Pages + components
                    are kept intact for easy re-enable. */}
                  <Route path="/session/:sessionId/interview/start" element={<InterviewToSimulation />} />
                  <Route path="/session/:sessionId/interview" element={<InterviewToSimulation />} />
                  <Route path="/session/:sessionId/interview/complete" element={<InterviewToSimulation />} />

                  <Route path="/session/:sessionId/simulation/start" element={<SessionPhase phase="simulation"><SimulationStartPage /></SessionPhase>} />
                  <Route path="/session/:sessionId/simulation" element={<SessionPhase phase="simulation"><SimulationPage /></SessionPhase>} />
                  <Route path="/session/:sessionId/simulation/complete" element={<Learning><SimulationCompletePage /></Learning>} />

                  <Route path="/session/:sessionId/complete" element={<Learning><SessionCompletePage /></Learning>} />

                  <Route path="/module/:moduleId/project/start" element={<Learning><ModuleProjectStartPage /></Learning>} />
                  <Route path="/module/:moduleId/project/tasks" element={<Learning><ModuleProjectTasksPage /></Learning>} />
                  <Route path="/module/:moduleId/project/complete" element={<Learning><ModuleProjectCompletePage /></Learning>} />

                  <Route path="/capstones" element={<Learning><CapstonesListPage /></Learning>} />
                  <Route path="/capstone/start" element={<Learning><CapstoneStartPage /></Learning>} />
                  <Route path="/capstone/tasks" element={<Learning><CapstoneTasksPage /></Learning>} />
                  <Route path="/capstone/:capstoneId/start" element={<Learning><CapstoneStartPage /></Learning>} />
                  <Route path="/capstone/:capstoneId/tasks" element={<Learning><CapstoneTasksPage /></Learning>} />
                  <Route path="/capstone/complete" element={<Learning><CapstoneCompletePage /></Learning>} />

                  {/* Wave 1 / 2 — Admin + Mock Interview */}
                  <Route path="/admin-panel" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                  <Route path="/mock-interview" element={<Learning><MockInterviewPage /></Learning>} />
                  <Route path="/mock-interview/:id" element={<Learning><MockInterviewPage /></Learning>} />
                  <Route path="/mock-interview/:id/results" element={<Learning><MockInterviewResults /></Learning>} />

                  {/* Module 20 — full interview simulations */}
                  <Route path="/interview-sims" element={<Learning><InterviewSimHub /></Learning>} />
                  <Route path="/interview-sim/:attemptId" element={<Learning><InterviewSimPlayer /></Learning>} />

                  {/* Payment routes */}
                  <Route path="/start" element={<ProtectedRoute><EnrollmentChoicePage /></ProtectedRoute>} />
                  <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
                  <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />

                  {/* 404 catch-all */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </PageTransition>
            </Suspense>
                </MilestonesProvider>
                </OpenDoubtsProvider>
                </DoubtsLauncherProvider>
                </TutorProvider>
                </DailyChallengesProvider>
                </BadgeProvider>
                </StreakProvider>
              </XPProvider>
            </SoundProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
