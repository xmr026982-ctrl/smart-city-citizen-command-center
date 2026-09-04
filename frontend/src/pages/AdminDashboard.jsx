import { useEffect, useState } from "react";
import api from "../services/api";
import socket, {
  connectAdminSocket,
  disconnectSocket
} from "../services/socket";

const AdminDashboard = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchIssues = async () => {
    try {
      setLoading(true);

      const response = await api.get("/issues");

      setIssues(response.data.issues || []);
      setError("");
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
        "Failed to load issues."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();

    connectAdminSocket();

    const handleIssueStatusUpdated = (data) => {
      console.log(
        "Real-time issue update:",
        data
      );

      setIssues((currentIssues) =>
        currentIssues.map((issue) =>
          issue._id === data.issue._id
            ? data.issue
            : issue
        )
      );
    };

    socket.on(
      "issue-status-updated",
      handleIssueStatusUpdated
    );

    return () => {
      socket.off(
        "issue-status-updated",
        handleIssueStatusUpdated
      );

      disconnectSocket();
    };
  }, []);

  const updateStatus = async (issueId, status) => {
    try {
      await api.patch(
        `/issues/${issueId}/status`,
        { status }
      );

      // The Socket.io event will update the UI.
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.message ||
        "Failed to update issue."
      );
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        Loading issues...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Admin Dashboard
        </h1>

        <p className="text-slate-400 mt-2">
          Real-time civic issue management
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-slate-400">
            Total Issues
          </p>

          <p className="text-3xl font-bold mt-2">
            {issues.length}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-slate-400">
            Submitted
          </p>

          <p className="text-3xl font-bold mt-2">
            {
              issues.filter(
                (issue) =>
                  issue.status === "submitted"
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-slate-400">
            In Progress
          </p>

          <p className="text-3xl font-bold mt-2">
            {
              issues.filter(
                (issue) =>
                  issue.status === "in_progress"
              ).length
            }
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-slate-400">
            Resolved
          </p>

          <p className="text-3xl font-bold mt-2">
            {
              issues.filter(
                (issue) =>
                  issue.status === "resolved"
              ).length
            }
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h2 className="text-xl font-semibold">
            Issue Management
          </h2>
        </div>

        {issues.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No issues found.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {issues.map((issue) => (
              <div
                key={issue._id}
                className="p-5 hover:bg-slate-800/40 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {issue.title}
                    </h3>

                    <p className="text-slate-400 text-sm mt-1">
                      {issue.description}
                    </p>

                    <div className="flex flex-wrap gap-3 mt-3 text-sm">
                      <span className="text-slate-400">
                        Category:{" "}
                        <span className="text-white">
                          {issue.category}
                        </span>
                      </span>

                      <span className="text-slate-400">
                        Reported by:{" "}
                        <span className="text-white">
                          {issue.reportedBy?.name ||
                            "Unknown"}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-3 py-2 rounded-lg bg-slate-800 text-sm">
                      {issue.status}
                    </span>

                    <select
                      value={issue.status}
                      onChange={(e) =>
                        updateStatus(
                          issue._id,
                          e.target.value
                        )
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="submitted">
                        Submitted
                      </option>

                      <option value="acknowledged">
                        Acknowledged
                      </option>

                      <option value="in_progress">
                        In Progress
                      </option>

                      <option value="resolved">
                        Resolved
                      </option>

                      <option value="rejected">
                        Rejected
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;