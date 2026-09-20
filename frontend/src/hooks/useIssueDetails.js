import { useIssues } from "../store/issueStore";

export function useIssueDetails(id) {
  const issues = useIssues();
  return issues.find((issue) => issue.id === id) || null;
}