import { useMemo, useState } from "react";
import { CATEGORY_LABEL } from "../constants/issueCategories";

export function useIssueFilters(issues) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      issues.filter((issue) => {
        if (status !== "all" && issue.status !== status) return false;
        const haystack = `${issue.id} ${issue.title} ${issue.location} ${CATEGORY_LABEL[issue.category]}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      }),
    [issues, status, query]
  );

  return { status, setStatus, query, setQuery, filtered };
}