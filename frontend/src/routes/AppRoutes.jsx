import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import IssueShell from "../components/layout/IssueShell";

/* public site and sign-in (no sign-in needed) */
import PublicOnly from "./PublicOnly";
import { PublicLayout } from "../components/public/PublicKit";
import Home from "../pages/public/Home";
import Preview from "../pages/public/Preview";
import About from "../pages/public/About";
import Contact from "../pages/public/Contact";
import SignIn from "../pages/public/SignIn";
import SignUp from "../pages/public/SignUp";
import ResetPassword from "../pages/public/ResetPassword";
import StaffRequest from "../pages/public/StaffRequest";
import StaffSetup from "../pages/public/StaffSetup";
import ConfirmEmail from "../pages/public/ConfirmEmail";

/* original desk pages */
import Settings from "../pages/common/Settings";
import Help from "../pages/common/Help";
import NotFound from "../pages/common/NotFound";
import Unauthorized from "../pages/common/Unauthorized";
const CitizenDashboard = lazy(() => import("../pages/citizen/CitizenDashboard")); // 3D city / map: loads without blocking the click
const StaffDashboard = lazy(() => import("../pages/staff/StaffDashboard")); // 3D city / map: loads without blocking the click
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard")); // 3D city / map: loads without blocking the click
import StaffDesk from "../pages/admin/StaffDesk";
const CityMap = lazy(() => import("../pages/common/CityMap")); // 3D city / map: loads without blocking the click
import Notifications from "../pages/common/Notifications";
import Community from "../pages/common/Community";

/* Issue Management pages */
import ReportIssue from "../pages/citizen/ReportIssue";
import MyReports from "../pages/citizen/MyReports";
import SavedReports from "../pages/citizen/SavedReports";
import CitizenIssueDetails from "../pages/citizen/CitizenIssueDetails";
import StaffOperations from "../pages/staff/StaffOperations";
import StaffWorkQueue from "../pages/staff/StaffWorkQueue";
import AssignedIssues from "../pages/staff/AssignedIssues";
import StaffPerformance from "../pages/staff/StaffPerformance";
import StaffIssueDetails from "../pages/staff/StaffIssueDetails";
import IssueCommand from "../pages/admin/IssueCommand";
import AllIssues from "../pages/admin/AllIssues";
import ManageAssignments from "../pages/admin/ManageAssignments";
import StaffManagement from "../pages/admin/StaffManagement";
import IssueAnalytics from "../pages/admin/IssueAnalytics";
import IssueAuditLogs from "../pages/admin/IssueAuditLogs";
import AdminIssueDetails from "../pages/admin/AdminIssueDetails";
import ServiceWindows from "../pages/admin/ServiceWindows";

function AppRoutes() {
  return (
    <Suspense fallback={<div className="page shell-wait" aria-busy="true" />}>
    <Routes>
      {/* ---------- public site and sign-in: a signed-in person goes to their desk ---------- */}
      <Route element={<PublicOnly />}>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
        <Route path="/login" element={<SignIn />} />
        <Route path="/register" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/staff-request" element={<StaffRequest />} />
        {/* the server emails /staff-setup; /staff-password is the older address of the same page */}
        <Route path="/staff-setup" element={<StaffSetup />} />
        <Route path="/staff-password" element={<StaffSetup />} />
        <Route path="/confirm-email" element={<ConfirmEmail />} />
      </Route>

      {/* ---------- desk pages ---------- */}
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute><CityMap /></ProtectedRoute>} />
      <Route path="/community/*" element={<RoleRoute allow={["citizen", "staff", "admin"]}><Community /></RoleRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/citizen/notifications" element={<Navigate to="/notifications" replace />} />
      <Route path="/staff/notifications" element={<Navigate to="/notifications" replace />} />
      <Route path="/admin/notifications" element={<Navigate to="/notifications" replace />} />

      <Route path="/citizen" element={<RoleRoute allow="citizen"><CitizenDashboard /></RoleRoute>} />
      <Route path="/staff" element={<RoleRoute allow="staff"><StaffDashboard /></RoleRoute>} />
      <Route path="/admin" element={<RoleRoute allow="admin"><AdminDashboard /></RoleRoute>} />
      <Route path="/admin/staff-desk" element={<RoleRoute allow="admin"><StaffDesk /></RoleRoute>} />

      {/* ---------- Issue Management pages (.ix scope; the top bar lives in the app frame) ---------- */}
      <Route element={<RoleRoute allow="citizen" />}>
        <Route element={<IssueShell />}>
          <Route path="/citizen/report" element={<ReportIssue />} />
          <Route path="/citizen/my-reports" element={<MyReports />} />
          <Route path="/citizen/saved" element={<SavedReports />} />
          <Route path="/citizen/issues/:id" element={<CitizenIssueDetails />} />
        </Route>
      </Route>

      <Route element={<RoleRoute allow="staff" />}>
        <Route element={<IssueShell />}>
          <Route path="/staff/operations" element={<StaffOperations />} />
          <Route path="/staff/queue" element={<StaffWorkQueue />} />
          <Route path="/staff/assigned" element={<AssignedIssues />} />
          <Route path="/staff/performance" element={<StaffPerformance />} />
          <Route path="/staff/issues/:id" element={<StaffIssueDetails />} />
        </Route>
      </Route>

      <Route element={<RoleRoute allow="admin" />}>
        <Route element={<IssueShell />}>
          <Route path="/admin/command" element={<IssueCommand />} />
          <Route path="/admin/queue" element={<AllIssues />} />
          <Route path="/admin/records" element={<Navigate to="/admin/command" replace />} />
          <Route path="/admin/assignments" element={<ManageAssignments />} />
          <Route path="/admin/staff" element={<StaffManagement />} />
          <Route path="/admin/analytics" element={<IssueAnalytics />} />
          <Route path="/admin/audit" element={<IssueAuditLogs />} />
          <Route path="/admin/windows" element={<ServiceWindows />} />
          <Route path="/admin/issues/:id" element={<AdminIssueDetails />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}

export default AppRoutes;
