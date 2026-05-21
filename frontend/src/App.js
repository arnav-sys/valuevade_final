import "@/App.css";
import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XPProvider } from "@/contexts/XPContext";
import { SoundProvider } from "@/contexts/SoundContext";
import { StreakProvider } from "@/contexts/StreakContext";
import { BadgeProvider } from "@/contexts/BadgeContext";
import { DailyChallengesProvider } from "@/contexts/DailyChallengesContext";
import { TutorProvider } from "@/contexts/TutorContext";
import XPRoot from "@/components/gamification/XPRoot";
import StreakRoot from "@/components/gamification/StreakRoot";
import BadgeRoot from "@/components/gamification/BadgeRoot";
import DailyChampionRoot from "@/components/gamification/DailyChampionRoot";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublicOnlyRoute from "@/components/PublicOnlyRoute";
import EnrollmentGuard from "@/components/EnrollmentGuard";
import SessionPhaseGuard from "@/components/SessionPhaseGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
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
const CapstoneTasksPage = lazyWithRetry(() => import("@/components/CapstoneTasksPage"));
const CapstoneCompletePage = lazyWithRetry(() => import("@/components/CapstoneCompletePage"));
const ProfilePage = lazyWithRetry(() => import("@/components/ProfilePage"));
const JourneyPage = lazyWithRetry(() => import("@/components/JourneyPage"));
const SettingsPage = lazyWithRetry(() => import("@/components/SettingsPage"));
const PortfolioPage = lazyWithRetry(() => import("@/components/PortfolioPage"));
const PublicPortfolioPage = lazyWithRetry(() => import("@/components/PublicPortfolioPage"));

/** Wraps a learning route in auth + enrollment guards. */
const Learning = ({ children }) => (
  <ProtectedRoute>
    <EnrollmentGuard>{children}</EnrollmentGuard>
  </ProtectedRoute>
);

/** Wraps a session phase route with phase-ordering guard. */
const SessionPhase = ({ phase, children }) => (
  <Learning>
    <SessionPhaseGuard phase={phase}>{children}</SessionPhaseGuard>
  </Learning>
);

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SoundProvider>
              <XPProvider>
                <StreakProvider>
                <BadgeProvider>
                <DailyChallengesProvider>
                <TutorProvider>
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
                <Suspense fallback={<RouteLoader />}>
              <PageTransition>
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
                  <Route path="/signuproute1" element={<Navigate to="/signup" replace />} />
                  <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                  <Route path="/referral" element={<AdminDashboard />} />
                  <Route path="/waitlist-arnav" element={<AdminDashboard />} />

                  {/* Public portfolio share (no auth) */}
                  <Route path="/p/:slug" element={<PublicPortfolioPage />} />

                  {/* Browsing / enrollment (auth only, no enrollment required) */}
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/course/:courseId" element={<CourseDetailsPage />} />
                  <Route path="/course/:courseId/customize" element={<ProtectedRoute><CustomizePage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/preview" element={<ProtectedRoute><PreviewPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/confirm" element={<ProtectedRoute><ConfirmPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/loading" element={<ProtectedRoute><LoadingPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/enrolled" element={<ProtectedRoute><EnrolledPage /></ProtectedRoute>} />

                  {/* Account (auth only) */}
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
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

                  <Route path="/session/:sessionId/interview/start" element={<SessionPhase phase="interview"><InterviewStartPage /></SessionPhase>} />
                  <Route path="/session/:sessionId/interview" element={<SessionPhase phase="interview"><InterviewPage /></SessionPhase>} />
                  <Route path="/session/:sessionId/interview/complete" element={<Learning><InterviewCompletePage /></Learning>} />

                  <Route path="/session/:sessionId/simulation/start" element={<SessionPhase phase="simulation"><SimulationStartPage /></SessionPhase>} />
                  <Route path="/session/:sessionId/simulation" element={<SessionPhase phase="simulation"><SimulationPage /></SessionPhase>} />
                  <Route path="/session/:sessionId/simulation/complete" element={<Learning><SimulationCompletePage /></Learning>} />

                  <Route path="/session/:sessionId/complete" element={<Learning><SessionCompletePage /></Learning>} />

                  <Route path="/module/:moduleId/project/start" element={<Learning><ModuleProjectStartPage /></Learning>} />
                  <Route path="/module/:moduleId/project/tasks" element={<Learning><ModuleProjectTasksPage /></Learning>} />
                  <Route path="/module/:moduleId/project/complete" element={<Learning><ModuleProjectCompletePage /></Learning>} />

                  <Route path="/capstone/start" element={<Learning><CapstoneStartPage /></Learning>} />
                  <Route path="/capstone/tasks" element={<Learning><CapstoneTasksPage /></Learning>} />
                  <Route path="/capstone/complete" element={<Learning><CapstoneCompletePage /></Learning>} />

                  {/* 404 catch-all */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </PageTransition>
            </Suspense>
                </TutorProvider>
                </DailyChallengesProvider>
                </BadgeProvider>
                </StreakProvider>
              </XPProvider>
            </SoundProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
