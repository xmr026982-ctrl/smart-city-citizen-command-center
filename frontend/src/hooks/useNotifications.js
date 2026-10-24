import { pushToast, useToasts } from "../store/notificationStore";

export function useNotifications() {
  return { toasts: useToasts(), pushToast };
}