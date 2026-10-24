import { Route, Routes } from "react-router-dom";
import Roledoor from "../pages/common/Roledoor";
import Settings from "../pages/common/Settings";
import Help from "../pages/common/Help";
import NotFound from "../pages/common/NotFound";
import Unauthorized from "../pages/common/Unauthorized";
import CitizenDashboard from "../pages/citizen/CitizenDashboard";
import StaffDashboard from "../pages/staff/StaffDashboard";
import AdminDashboard from "../pages/admin/AdminDashboard";
import IssueRecords from "../pages/admin/IssueRecords";
import StaffDesk from "../pages/admin/StaffDesk";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Roledoor />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />

      <Route path="/citizen" element={<RoleRoute allow="citizen"><CitizenDashboard /></RoleRoute>} />

      <Route path="/staff" element={<RoleRoute allow="staff"><StaffDashboard /></RoleRoute>} />

      <Route path="/admin" element={<RoleRoute allow="admin"><AdminDashboard /></RoleRoute>} />
      <Route path="/admin/records" element={<RoleRoute allow="admin"><IssueRecords /></RoleRoute>} />
      <Route path="/admin/staff-desk" element={<RoleRoute allow="admin"><StaffDesk /></RoleRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;