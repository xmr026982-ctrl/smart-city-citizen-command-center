import { BrowserRouter, Routes, Route } from "react-router-dom";

import UserMap from "./pages/User/UserMap";
import StaffMap from "./pages/Staff/StaffMap";
import AdminMap from "./pages/Admin/AdminMap";

import AppRoutes from "./routes/AppRoutes";
import { ToastProvider } from "./components/ui/Toast";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>

          {/* ================= MAP ROUTES ================= */}
          <Route path="/user/map" element={<UserMap />} />
          <Route path="/staff/map" element={<StaffMap />} />
          <Route path="/admin/map" element={<AdminMap />} />

          {/* ================= ISSUE MANAGEMENT ROUTES ================= */}
          <Route path="/*" element={<AppRoutes />} />

        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;