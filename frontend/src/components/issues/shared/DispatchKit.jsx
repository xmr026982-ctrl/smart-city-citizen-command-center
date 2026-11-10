import { useEffect, useMemo, useState } from "react";
import { Send, Sparkles, ArrowRight, Check } from "lucide-react";
import { CatGlyph } from "../admin/CommandKit";
import { assignIssue } from "../../../store/issueStore";
import { fieldNotices, markRead, readCursor } from "../../../store/notifyStore";
import { showUndo } from "./RemovalKit";
import "../../../styles/dispatch.css";

/* ------------------------------------------------------------------
   Dispatch receipt. A dispatch never just makes a row vanish:
   - the row turns into a receipt in place ("Dispatched → Rupa
     Chatterjee · 2/6 → 3/6") for a few seconds, then slides out
   - an Undo notice (8 s) puts it back exactly as it was
   - the field sees "New · ISS-2413 assigned to you" the next time
     they open Assigned Work, and the row glows once
------------------------------------------------------------------- */
const RECEIPT_MS = 2300; // held 1.5 s, then it fades while the rows below glide up

export function useReceipts() {
  const [list, setList] = useState([]);
  const add = (r) => {
    const key = `${r.id}-${Date.now()}`;
    setList((cur) => [...cur.filter((x) => x.id !== r.id), { ...r, key }]);
    setTimeout(() => setList((cur) => cur.filter((x) => x.key !== key)), RECEIPT_MS);
  };
  return [list, add];
}

/* assign with a receipt + undo. Returns true when it moved. */
export function dispatchWithReceipt({ issue, to, user, note = "", roster = [], cap = 6, onReceipt }) {
  const person = roster.find((p) => p.name === to);
  const before = person ? person.load : null;
  const undo = assignIssue(issue.id, to, user.name, user.role, note);
  if (!undo) return false;
  onReceipt?.({ id: issue.id, title: issue.title, category: issue.category, ward: issue.ward, to, before, cap, reassigned: Boolean(issue.assignedTo) });
  showUndo(`${issue.id} ${issue.assignedTo ? "reassigned" : "dispatched"} to ${to}`, undo, "send");
  return true;
}

/* The dispatched row keeps its shape: its action turns into a confirmed
   crew chip, one scan line passes, then it fades and the gap closes. */
export function DispatchReceipt({ receipt, variant = "mini" }) {
  const initials = receipt.to.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`dx-wrap ${variant}`} role="status">
      <div className="dx-row">
        <span className="dx-scan" aria-hidden />
        {receipt.category ? <CatGlyph category={receipt.category} size={variant === "row" ? 40 : 32} /> : <span className="dx-ic"><Send size={14} /></span>}
        <div className="dx-main">
          <strong>{receipt.title}</strong>
          <small><span className="ac-id">{receipt.id}</span>{receipt.ward ? <> · {receipt.ward}</> : null}</small>
        </div>
        <span className="dx-done">
          <Check size={13} strokeWidth={2.6} />
          <span className="dx-av">{initials}</span>
          <span className="dx-to">{receipt.to}</span>
          {receipt.before !== null ? <em>{receipt.before}<ArrowRight size={9} />{receipt.before + 1}/{receipt.cap}</em> : null}
        </span>
      </div>
    </div>
  );
}

/* ---------------- field side: new work since you last looked ----------------
   Reads the shared notification cursor (store/notifyStore.js): what's new is
   what landed after it. Opening Assigned Work marks it read (the sidebar
   badge clears), while the rows keep their "New" mark for this visit. */
export function useNewAssignments(audit, everything, me) {
  const [since] = useState(() => readCursor(me));
  const items = useMemo(
    () => fieldNotices(audit, everything, me)
      .filter((n) => n.kind === "assigned" && n.t > since)
      .map((n) => ({ e: { id: n.key }, issue: everything.find((i) => i.id === n.issueId) }))
      .filter(({ issue }) => issue && issue.assignedTo === me && !issue.removed && issue.status !== "resolved"),
    [audit, everything, me, since]
  );
  useEffect(() => { if (me) markRead(me); }, [me, audit]);
  return { items, ids: new Set(items.map((x) => x.issue.id)) };
}

export function NewWorkNotices({ items }) {
  const [shown, setShown] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShown(false), 9000); return () => clearTimeout(t); }, []);
  if (!shown || !items.length) return null;
  return (
    <div className="dx-notices" role="status">
      {items.slice(0, 3).map(({ e, issue }) => (
        <p key={e.id} className="dx-notice"><Sparkles size={13} /> New · <b>{issue.id}</b> assigned to you · {issue.title}</p>
      ))}
      {items.length > 3 ? <p className="dx-notice more">+{items.length - 3} more new on you</p> : null}
    </div>
  );
}