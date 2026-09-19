import { Navigate, Route, Routes } from "react-router-dom";

function PlaceholderPage({ title }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "40px",
        background: "var(--sc-bg)",
        color: "var(--sc-text-primary)",
      }}
    >
      <section
        style={{
          width: "min(100%, 720px)",
          padding: "40px",
          borderRadius: "var(--sc-radius-xl)",
          background: "var(--sc-surface)",
          border: "1px solid var(--sc-border)",
          boxShadow: "var(--sc-shadow-lg)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            marginBottom: "10px",
            color: "var(--sc-accent)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Smart City Command Center
        </p>

        <h1>{title}</h1>

        <p>
          This module is being connected to the new Smart City interface.
        </p>
      </section>
    </main>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/dashboard"
        element={<PlaceholderPage title="City Dashboard" />}
      />

      <Route
        path="/issues"
        element={<PlaceholderPage title="Issue Management" />}
      />

      <Route
        path="/issues/my-reports"
        element={<PlaceholderPage title="My Reports" />}
      />

      <Route
        path="/issues/:issueId"
        element={<PlaceholderPage title="Issue Details" />}
      />

      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />
    </Routes>
  );
}

export default AppRoutes;