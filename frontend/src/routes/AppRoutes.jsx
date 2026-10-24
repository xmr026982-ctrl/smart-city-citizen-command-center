import { Route, Routes } from "react-router-dom";
import Roledoor from "../pages/common/Roledoor";
import Settings from "../pages/common/Settings";
import Help from "../pages/common/Help";
import NotFound from "../pages/common/NotFound";
import Unauthorized from "../pages/common/Unauthorized";
import CitizenDashboard from "../pages/citizen/CitizenDashboard";
import ReportIssueDoor from "../pages/citizen/ReportIssueDoor";
import CitizenMapDoor from "../pages/citizen/MapDoor";
import CitizenCommunityDoor from "../pages/citizen/CommunityDoor";
import CitizenNotificationsDoor from "../pages/citizen/NotificationsDoor";
import StaffDashboard from "../pages/staff/StaffDashboard";
import StaffMapDoor from "../pages/staff/MapDoor";
import AssignedWorkDoor from "../pages/staff/AssignedWorkDoor";
import StaffNotificationsDoor from "../pages/staff/NotificationsDoor";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminMapDoor from "../pages/admin/MapDoor";
import AdminCommunityDoor from "../pages/admin/CommunityDoor";
import IssueRecords from "../pages/admin/IssueRecords";
import StaffDesk from "../pages/admin/StaffDesk";
import AdminNotificationsDoor from "../pages/admin/NotificationsDoor";
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
      <Route path="/citizen/report" element={<RoleRoute allow="citizen"><ReportIssueDoor /></RoleRoute>} />
      <Route path="/citizen/map" element={<RoleRoute allow="citizen"><CitizenMapDoor /></RoleRoute>} />
      <Route path="/citizen/community" element={<RoleRoute allow="citizen"><CitizenCommunityDoor /></RoleRoute>} />
      <Route path="/citizen/notifications" element={<RoleRoute allow="citizen"><CitizenNotificationsDoor /></RoleRoute>} />

      <Route path="/staff" element={<RoleRoute allow="staff"><StaffDashboard /></RoleRoute>} />
      <Route path="/staff/map" element={<RoleRoute allow="staff"><StaffMapDoor /></RoleRoute>} />
      <Route path="/staff/assigned" element={<RoleRoute allow="staff"><AssignedWorkDoor /></RoleRoute>} />
      <Route path="/staff/notifications" element={<RoleRoute allow="staff"><StaffNotificationsDoor /></RoleRoute>} />

      <Route path="/admin" element={<RoleRoute allow="admin"><AdminDashboard /></RoleRoute>} />
      <Route path="/admin/map" element={<RoleRoute allow="admin"><AdminMapDoor /></RoleRoute>} />
      <Route path="/admin/community" element={<RoleRoute allow="admin"><AdminCommunityDoor /></RoleRoute>} />
      <Route path="/admin/records" element={<RoleRoute allow="admin"><IssueRecords /></RoleRoute>} />
      <Route path="/admin/staff-desk" element={<RoleRoute allow="admin"><StaffDesk /></RoleRoute>} />
      <Route path="/admin/notifications" element={<RoleRoute allow="admin"><AdminNotificationsDoor /></RoleRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;