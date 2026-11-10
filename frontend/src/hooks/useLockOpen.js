import { useCallback, useEffect, useState } from "react";

/* ------------------------------------------------------------------
   Lock, then open. One arrival rule for every issue list:

     1. a link lands here (?file=ISS-… or { open } in the route state)
     2. the list jumps to the page that holds the issue
     3. the row glides into view and locks (brackets, the rest dims)
     4. a beat later the file opens on top of it
     5. when the file closes the row stays locked for a moment, so you
        see where you are, then lets go. Esc lets go at once.

   The page clears its filters before arming, so the row is always on
   the list. A file that is not on the list (merged, dismissed) opens
   straight away.
------------------------------------------------------------------- */
export function useLockOpen({ list, size, setPage, open, delay = 650 }) {
  const [lock, setLock] = useState(null); // { id, at, opened, held }
  const arm = useCallback((id) => { if (id) setLock({ id, at: Date.now(), opened: false, held: 0 }); }, []);
  const index = lock ? list.findIndex((i) => i.id === lock.id) : -1;
  const onList = index >= 0;

  // 2. the page that holds it
  useEffect(() => {
    if (!lock || lock.opened || !onList) return;
    setPage(Math.floor(index / size) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock?.at, index, size]);

  // 3 + 4. glide, hold, open
  useEffect(() => {
    if (!lock || lock.opened) return undefined;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const at = lock.at;
    const done = () => setLock((l) => (l && l.at === at ? { ...l, opened: true } : l));
    if (!onList) { open(lock.id); done(); return undefined; }
    const glide = setTimeout(() => {
      const row = document.querySelector(`[data-glide="${lock.id}"], [data-issue="${lock.id}"]`);
      row?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }, 90);
    const go = setTimeout(() => { open(lock.id); done(); }, reduce ? 160 : delay);
    return () => { clearTimeout(glide); clearTimeout(go); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock?.at, lock?.opened, onList]);

  // 5. the file closed: hold the lock a moment, then let go
  const closed = useCallback(() => setLock((l) => (l ? { ...l, opened: true, held: Date.now() } : l)), []);
  useEffect(() => {
    if (!lock?.held) return undefined;
    const t = setTimeout(() => setLock(null), 2400);
    return () => clearTimeout(t);
  }, [lock?.held]);

  // Esc lets go (an open file handles its own Esc first)
  const locked = Boolean(lock);
  useEffect(() => {
    if (!locked) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector("[aria-modal='true']")) return;
      setLock(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked]);

  const release = useCallback(() => setLock(null), []);
  return { lockedId: lock?.id || null, arming: Boolean(lock && !lock.opened), arm, closed, release };
}
