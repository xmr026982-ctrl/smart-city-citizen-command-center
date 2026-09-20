import { addIssue, assignIssue, getIssues, nextIssueId, updateStatus } from "../store/issueStore";

export const issueService = {
  list: () => getIssues(),
  create: (issue) => addIssue(issue),
  nextId: () => nextIssueId(),
  setStatus: (id, status, by) => updateStatus(id, status, by),
  assign: (id, staff, by) => assignIssue(id, staff, by),
};