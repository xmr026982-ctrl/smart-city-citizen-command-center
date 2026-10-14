import { STATUS_LABEL } from "../constants/issueStatuses";

export function formatStatus(status) {
  return STATUS_LABEL[status] || status;
}