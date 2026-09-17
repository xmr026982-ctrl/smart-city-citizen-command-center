import { Routes, Route } from "react-router-dom";

// Issue Management pages
import IssueManagement from "../pages/IssueManagement";
import MyReports from "../pages/MyReports";
import IssueDetailsPage from "../pages/IssueDetailsPage";

function AppRoutes() {
  return (
    <Routes>
      {/* Issue Reporting */}
      <Route path="/report-issue" element={<IssueManagement />} />
      <Route path="/my-reports" element={<MyReports />} />
      <Route path="/issues/:id" element={<IssueDetailsPage />} />

      {/* Optional: redirect root to report page while testing */}
      <Route path="/" element={<IssueManagement />} />
    </Routes>
  );
}

export default AppRoutes;