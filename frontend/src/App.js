import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "@/components/LandingPage";
import AdminDashboard from "@/components/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/referral" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
