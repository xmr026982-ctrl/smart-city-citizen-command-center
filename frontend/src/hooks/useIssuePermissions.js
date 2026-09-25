import { useAuth } from "../store/authStore";
import {
  canAssignIssues,
  canChangeCategory,
  canOperateIssues,
  canSetPriority,
  canUpdateStatus,
} from "../utils/permissionHelper";

export function useIssuePermissions() {
  const user = useAuth();

  return {
    role: user.role,
    canOperate: canOperateIssues(user.role),
    canUpdateStatus: canUpdateStatus(user.role),
    canAssign: canAssignIssues(user.role),
    canSetPriority: canSetPriority(user.role),
    canChangeCategory: canChangeCategory(user.role),
  };
}