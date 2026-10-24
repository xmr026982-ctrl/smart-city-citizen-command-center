import { addIssue, assignIssue, getIssues, nextIssueId, updateStatus } from "../store/issueStore";

export const issueService = {
  list: () => getIssues(),
  create: (issue) => addIssue(issue),
  nextId: () => nextIssueId(),
  setStatus: (id, status, by, role) => updateStatus(id, status, by, role),
  assign: (id, staff, by, role) => assignIssue(id, staff, by, role),
};