/* ------------------------------------------------------------------
   One rule for "open this issue file", from anywhere (map, trace,
   notifications later): each role lands on its own issue page with the
   file locked on.
     admin   → All Issues, drawer open
     staff   → Assigned Work, target lock (own files only)
     citizen → My Reports, report open (own reports only)
   The id travels in the URL (?file=ISS-2413), so a reload or a shared
   link still lands on it. Each page reads it once, then clears it.
------------------------------------------------------------------- */
const HOME = { admin: "/admin/queue", staff: "/staff/assigned", citizen: "/citizen/my-reports" };

export function fileLink(role, id, from = "") {
  const q = new URLSearchParams({ file: id });
  if (from) q.set("from", from);
  return `${HOME[role] || HOME.citizen}?${q.toString()}`;
}

/* { id, from } when the current URL carries a file, else null */
export function readFileParam(search = "") {
  const q = new URLSearchParams(search);
  const id = q.get("file");
  return id ? { id, from: q.get("from") || "" } : null;
}