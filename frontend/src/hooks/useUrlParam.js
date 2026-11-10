import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* ------------------------------------------------------------------
   A page's view kept in the address: /community?tab=polls&zone=Ballygunge.
   Reload keeps it, Back and Forward move through it, a copied link opens
   the same view. Unknown values fall back to the default, so a typo or an
   old link never breaks the page.

   const [tab, setTab] = useUrlParam("tab", { allowed: ["a", "b"], fallback: "a" });
   setTab("b")                 replaces the address (filters, sorts)
   setTab("b", { push: true }) adds a step Back returns to (tabs, drawers)
   setParams({ tab: "b", show: "" })  several at once ("" or the default removes one)
------------------------------------------------------------------- */
function write(navigate, changes, { push = false, state } = {}) {
  // read the live address: two changes in one click must not undo each other
  const p = new URLSearchParams(window.location.search);
  Object.entries(changes).forEach(([k, v]) => { if (v === "" || v == null) p.delete(k); else p.set(k, String(v)); });
  const qs = p.toString();
  navigate(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { replace: !push, state });
}

export function useUrlParam(key, { allowed, fallback = "" } = {}) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const raw = new URLSearchParams(search).get(key);
  const value = raw && (!allowed || allowed.includes(raw)) ? raw : fallback;
  const set = useCallback(
    (v, opts) => write(navigate, { [key]: v === fallback ? "" : v }, opts),
    [navigate, key, fallback]
  );
  return [value, set];
}

/** Several keys in one step. */
export function useSetParams() {
  const navigate = useNavigate();
  return useCallback((changes, opts) => write(navigate, changes, opts), [navigate]);
}

/* A drawer that lives in the address (?p=PRP-0107): opening adds a step,
   so Back closes it; closing a drawer this page opened steps back,
   one opened from a shared link just leaves the address. */
export function useUrlDrawer(key = "p") {
  const { search, state } = useLocation();
  const navigate = useNavigate();
  const id = new URLSearchParams(search).get(key) || null;
  const open = useCallback((v) => write(navigate, { [key]: v }, { push: true, state: { drawer: key } }), [navigate, key]);
  const close = useCallback(() => {
    if (state?.drawer === key) navigate(-1);
    else write(navigate, { [key]: "" });
  }, [navigate, key, state]);
  return [id, open, close];
}
