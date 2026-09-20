import { useMemo, useState } from "react";
import IssueDetailsDrawer from "../../components/issues/shared/IssueDetailsDrawer";
import IssueFilters from "../../components/issues/shared/IssueFilters";
import IssueSearch from "../../components/issues/shared/IssueSearch";
import IssueTable from "../../components/issues/shared/IssueTable";
import PageHeader from "../../components/layout/PageHeader";
import { Select } from "../../components/ui/Input";
import { CATEGORY_LABEL } from "../../constants/issueCategories";
import { useIssues } from "../../store/issueStore";

function AllIssues() {
  const issues = useIssues();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [ward, setWard] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const wards = [...new Set(issues.map((issue) => issue.ward))];

  const filtered = useMemo(
    () =>
      issues.filter((issue) => {
        if (filter !== "all" && issue.status !== filter) return false;
        if (ward !== "all" && issue.ward !== ward) return false;
        const haystack = `${issue.id} ${issue.title} ${issue.location} ${CATEGORY_LABEL[issue.category]}`.toLowerCase();
        if (query && !haystack.includes(query.toLowerCase())) return false;
        return true;
      }),
    [issues, filter, query, ward]
  );

  const selected = issues.find((issue) => issue.id === selectedId) || null;

  return (
    <main className="page-stack">
      <PageHeader eyebrow="Work queue" title="City ledger" description="Every civic issue currently on the board." />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <IssueSearch value={query} onChange={setQuery} />
        </div>
        <Select value={ward} onChange={(e) => setWard(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">All wards</option>
          {wards.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>
      <IssueFilters value={filter} onChange={setFilter} />
      <IssueTable issues={filtered} onSelect={(issue) => setSelectedId(issue.id)} />
      <IssueDetailsDrawer issue={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export default AllIssues;