import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import LandingPage from "@/components/LandingPage";
import AdminDashboard from "@/components/AdminDashboard";
import SignupPage from "@/components/SignupPage";
import LoginPage from "@/components/LoginPage";
import CoursesPage from "@/components/CoursesPage";
import CourseDetailsPage from "@/components/CourseDetailsPage";
import DashboardPage from "@/components/DashboardPage";
import ProtectedRoute from "@/components/ProtectedRoute";

function App() {
  return (
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
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
            <Route path="/course/:courseId" element={<ProtectedRoute><CourseDetailsPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/referral" element={<AdminDashboard />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
