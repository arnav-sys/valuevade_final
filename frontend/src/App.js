import "@/App.css";
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import EnrollmentGuard from "@/components/EnrollmentGuard";
import SessionPhaseGuard from "@/components/SessionPhaseGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteLoader from "@/components/RouteLoader";
import PageTransition from "@/components/PageTransition";

// Public (eager-load: small, fast, frequent entry points)
import LandingPage from "@/components/LandingPage";
import SignupPage from "@/components/SignupPage";
import LoginPage from "@/components/LoginPage";
import AdminDashboard from "@/components/AdminDashboard";
import NotFoundPage from "@/components/NotFoundPage";

// Authenticated — lazy loaded for faster initial bundle
const CoursesPage = lazy(() => import("@/components/CoursesPage"));
const CourseDetailsPage = lazy(() => import("@/components/CourseDetailsPage"));
const CustomizePage = lazy(() => import("@/components/CustomizePage"));
const PreviewPage = lazy(() => import("@/components/PreviewPage"));
const ConfirmPage = lazy(() => import("@/components/ConfirmPage"));
const LoadingPage = lazy(() => import("@/components/LoadingPage"));
const EnrolledPage = lazy(() => import("@/components/EnrolledPage"));
const DashboardPage = lazy(() => import("@/components/DashboardPage"));
const SessionStartPage = lazy(() => import("@/components/SessionStartPage"));
const NotesPage = lazy(() => import("@/components/NotesPage"));
const NotesCompletePage = lazy(() => import("@/components/NotesCompletePage"));
const QuizStartPage = lazy(() => import("@/components/QuizStartPage"));
const QuizPage = lazy(() => import("@/components/QuizPage"));
const QuizCompletePage = lazy(() => import("@/components/QuizCompletePage"));
const InterviewStartPage = lazy(() => import("@/components/InterviewStartPage"));
const InterviewPage = lazy(() => import("@/components/InterviewPage"));
const InterviewCompletePage = lazy(() => import("@/components/InterviewCompletePage"));
const SimulationStartPage = lazy(() => import("@/components/SimulationStartPage"));
const SimulationPage = lazy(() => import("@/components/SimulationPage"));
const SimulationCompletePage = lazy(() => import("@/components/SimulationCompletePage"));
const SessionCompletePage = lazy(() => import("@/components/SessionCompletePage"));
const ModuleProjectStartPage = lazy(() => import("@/components/ModuleProjectStartPage"));
const ModuleProjectTasksPage = lazy(() => import("@/components/ModuleProjectTasksPage"));
const ModuleProjectCompletePage = lazy(() => import("@/components/ModuleProjectCompletePage"));
const CapstoneStartPage = lazy(() => import("@/components/CapstoneStartPage"));
const CapstoneTasksPage = lazy(() => import("@/components/CapstoneTasksPage"));
const CapstoneCompletePage = lazy(() => import("@/components/CapstoneCompletePage"));
const ProfilePage = lazy(() => import("@/components/ProfilePage"));
const SettingsPage = lazy(() => import("@/components/SettingsPage"));

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
            <Toaster
              position="top-center"
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
            <Suspense fallback={<RouteLoader />}>
              <PageTransition>
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/referral" element={<AdminDashboard />} />
                  <Route path="/waitlist-arnav" element={<AdminDashboard />} />

                  {/* Browsing / enrollment (auth only, no enrollment required) */}
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/course/:courseId" element={<ProtectedRoute><CourseDetailsPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/customize" element={<ProtectedRoute><CustomizePage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/preview" element={<ProtectedRoute><PreviewPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/confirm" element={<ProtectedRoute><ConfirmPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/loading" element={<ProtectedRoute><LoadingPage /></ProtectedRoute>} />
                  <Route path="/course/:courseId/enrolled" element={<ProtectedRoute><EnrolledPage /></ProtectedRoute>} />

                  {/* Account (auth only) */}
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
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
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
