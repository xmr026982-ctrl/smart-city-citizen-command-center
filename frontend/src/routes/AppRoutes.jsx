import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "../components/layout/Layout";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import SignIn from "../pages/common/SignIn";
import ReportIssue from "../pages/citizen/ReportIssue";
import MyReports from "../pages/citizen/MyReports";
import CitizenIssueDetails from "../pages/citizen/CitizenIssueDetails";
import SavedReports from "../pages/citizen/SavedReports";
import StaffWorkQueue from "../pages/staff/StaffWorkQueue";
import AssignedIssues from "../pages/staff/AssignedIssues";
import StaffDashboard from "../pages/staff/StaffDashboard";
import StaffIssueDetails from "../pages/staff/StaffIssueDetails";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AllIssues from "../pages/admin/AllIssues";
import ManageAssignments from "../pages/admin/ManageAssignments";
import IssueAnalytics from "../pages/admin/IssueAnalytics";
import IssueAuditLogs from "../pages/admin/IssueAuditLogs";
import AdminIssueDetails from "../pages/admin/AdminIssueDetails";
import NotFound from "../pages/common/NotFound";
import { useAuth } from "../store/authStore";

function HomeRedirect() {
  const user = useAuth();
  if (!user) return <Navigate to="/sign-in" replace />;
  if (user.role === "staff") return <Navigate to="/staff/assigned" replace />;
  if (user.role === "admin") return <Navigate to="/admin/command" replace />;
  return <Navigate to="/citizen/report" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<RoleRoute allow={["citizen"]} />}>
            <Route path="/citizen/report" element={<ReportIssue />} />
            <Route path="/citizen/my-reports" element={<MyReports />} />
            <Route path="/citizen/saved" element={<SavedReports />} />
            <Route path="/citizen/issues/:id" element={<CitizenIssueDetails />} />
          </Route>

          <Route element={<RoleRoute allow={["staff"]} />}>
            <Route path="/staff" element={<StaffDashboard />} />
            <Route path="/staff/queue" element={<StaffWorkQueue />} />
            <Route path="/staff/assigned" element={<AssignedIssues />} />
            <Route path="/staff/issues/:id" element={<StaffIssueDetails />} />
          </Route>

          <Route element={<RoleRoute allow={["admin"]} />}>
            <Route path="/admin/command" element={<AdminDashboard />} />
            <Route path="/admin/queue" element={<AllIssues />} />
            <Route path="/admin/assignments" element={<ManageAssignments />} />
            <Route path="/admin/analytics" element={<IssueAnalytics />} />
            <Route path="/admin/audit" element={<IssueAuditLogs />} />
            <Route path="/admin/issues/:id" element={<AdminIssueDetails />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default AppRoutes;