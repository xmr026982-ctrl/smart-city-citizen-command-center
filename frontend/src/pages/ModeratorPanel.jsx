import { useEffect, useState } from "react";
import api from "../services/api";
import socket, {
  connectSocket,
  disconnectSocket
} from "../services/socket";

const ModeratorPanel = () => {
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

    connectSocket();

    const handleIssueStatusUpdated = (data) => {
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
      <div className="min-h-screen bg-slate-950 text-white p-8">
        Loading moderator panel...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Moderator Panel
        </h1>

        <p className="text-slate-400 mt-2">
          Monitor and manage civic issues in real time.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-slate-400">
            Total
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
            Civic Issues
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
                className="p-5"
              >
                <div className="flex flex-col lg:flex-row lg:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {issue.title}
                    </h3>

                    <p className="text-slate-400 mt-1">
                      {issue.description}
                    </p>

                    <div className="text-sm text-slate-400 mt-3">
                      Category:{" "}
                      <span className="text-white">
                        {issue.category}
                      </span>
                    </div>

                    <div className="text-sm text-slate-400 mt-1">
                      Citizen:{" "}
                      <span className="text-white">
                        {issue.reportedBy?.name ||
                          "Unknown"}
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
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
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

export default ModeratorPanel;