import { WARDS } from "../constants/issueConstants";

export function useIssueLocation(wardName) {
  return WARDS.find((ward) => ward.name === wardName) || null;
}