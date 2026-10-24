import { firstErrorKey, validateIssueDraft } from "../utils/validateIssue";

export function useIssueValidation() {
  return { validateIssueDraft, firstErrorKey };
}