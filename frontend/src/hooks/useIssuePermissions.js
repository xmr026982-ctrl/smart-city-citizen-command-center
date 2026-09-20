import { useAuth } from "../store/authStore";
import { canAssignIssues, canOperateIssues } from "../utils/permissionHelper";

export function useIssuePermissions() {
  const user = useAuth();
  return {
    role: user.role,
    canOperate: canOperateIssues(user.role),
    canAssign: canAssignIssues(user.role),
  };
}