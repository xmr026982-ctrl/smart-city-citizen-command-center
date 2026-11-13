import { dayYear, stamp } from "./time";

/* 8 Nov 2026 */
export function formatDate(iso) {
  return dayYear(iso);
}

/* 8 Nov 2026 · 17:18 (24-hour IST) */
export function formatDateTime(iso) {
  return stamp(iso);
}
