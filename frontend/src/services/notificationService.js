import { pushToast } from "../store/notificationStore";

export const notificationService = {
  success(message) {
    pushToast(message);
  },
};