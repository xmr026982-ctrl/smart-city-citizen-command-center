import { useState } from "react";
import IssueCard from "../components/issues/IssueCard";
import IssueFilters from "../components/issues/IssueFilters";
import IssueDetailsDrawer from "../components/issues/IssueDetailsDrawer";
import "../styles/issue.css";

function MyReports() {
  // Temporary mock data – replace later with real API
  const [reports] = useState([
    {
      id: "ISS-2401",
      title: "Broken streetlight near Central Park",
      category: "Street Lighting",
      location: "Sector 12, Main Road",
      status: "In Progress",
      createdAt: "12 Sep 2026",
      updatedAt: "15 Sep 2026",
      description:
        "The streetlight has been non-functional for the past week. The area becomes very dark after sunset, creating safety concerns for pedestrians and residents.",
    },
    {
      id: "ISS-2398",
      title: "Water leakage on 3rd Avenue",
      category: "Water Supply",
      location: "Near City Mall",
      status: "Acknowledged",
      createdAt: "10 Sep 2026",
      updatedAt: "11 Sep 2026",
      description:
        "Continuous water leakage from a broken pipe is flooding the footpath and wasting water.",
    },
    {
      id: "ISS-2385",
      title: "Garbage pile-up behind market",
      category: "Waste Management",
      location: "Old Market Lane",
      status: "Resolved",
      createdAt: "05 Sep 2026",
      updatedAt: "14 Sep 2026",
      description:
        "Large pile of uncollected garbage has been accumulating behind the market for several days.",
    },
  ]);

  const [filter, setFilter] = useState("All");
  const [selectedReport, setSelectedReport] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const filteredReports =
    filter === "All"
      ? reports
      : reports.filter((r) => r.status === filter);

  const openDrawer = (report) => {
    setSelectedReport(report);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedReport(null);
  };

  return (
    <main className="issue-management-page">
      {/* Hero */}
      <section className="issue-page-hero" style={{ gridTemplateColumns: "1fr" }}>
        <div
          className="issue-hero-content"
          style={{ minHeight: "auto", padding: "56px 64px" }}
        >
          <span className="issue-eyebrow">CITIZEN SERVICES / MY REPORTS</span>
          <h1 style={{ fontSize: "clamp(36px, 4.5vw, 58px)", margin: "28px 0 18px" }}>
            Your submitted reports
          </h1>
          <p style={{ maxWidth: "640px", marginBottom: 0 }}>
            Track every civic issue you have reported. View live status, updates,
            and history in one clean place.
          </p>
        </div>
      </section>

      {/* Filters + List */}
      <section className="issue-form-section" style={{ marginTop: 32, padding: "36px 40px" }}>
        <div className="issue-section-heading" style={{ marginBottom: 28 }}>
          <div>
            <span className="issue-eyebrow">YOUR ACTIVITY</span>
            <h2 style={{ fontSize: "clamp(28px, 3.2vw, 40px)", margin: "14px 0 8px" }}>
              {filteredReports.length} report{filteredReports.length !== 1 ? "s" : ""}
            </h2>
            <p style={{ margin: 0 }}>Filter by current status</p>
          </div>
        </div>

        <IssueFilters activeFilter={filter} onFilterChange={setFilter} />

        <div style={{ marginTop: 36, display: "grid", gap: 18 }}>
          {filteredReports.length === 0 ? (
            <div
              style={{
                padding: "48px 32px",
                textAlign: "center",
                border: "1px dashed #cbd5e1",
                borderRadius: 20,
                background: "#f8fafc",
                color: "#64748b",
              }}
            >
              <p style={{ margin: 0, fontSize: 15 }}>
                No reports found for this status.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => openDrawer(report)}
                style={{ cursor: "pointer" }}
              >
                <IssueCard report={report} />
              </div>
            ))
          )}
        </div>
      </section>

      {/* Details Drawer */}
      <IssueDetailsDrawer
        report={selectedReport}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
      />
    </main>
  );
}

export default MyReports;