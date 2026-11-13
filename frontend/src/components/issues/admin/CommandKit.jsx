import { useEffect, useLayoutEffect, useRef } from "react";
import {
  Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Car, Lightbulb, Droplets, Trash2, Zap, ShieldAlert, MoreHorizontal, Hourglass, ArrowDownUp,
} from "lucide-react";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { STATUS_LABEL } from "../../../constants/issueStatuses";
import { PRIORITY_LABEL } from "../../../constants/issuePriorities";
import { slaOf } from "../../../utils/sla";
import "../../../styles/admin-command.css";
import "../../../styles/admin-command-live.css";

/* ------------------------------------------------------------------
   Civic Command kit: the shared building blocks of every admin
   Issue Management page (violet admin look, same family as Staff Desk).
------------------------------------------------------------------- */

export const CAT_META = {
  roads: { icon: Car, color: "#6366f1" },
  lighting: { icon: Lightbulb, color: "#f59e0b" },
  water: { icon: Droplets, color: "#0ea5e9" },
  waste: { icon: Trash2, color: "#10b981" },
  electricity: { icon: Zap, color: "#a855f7" },
  safety: { icon: ShieldAlert, color: "#ef4444" },
  other: { icon: MoreHorizontal, color: "#64748b" },
};

export function Command({ children, className = "" }) {
  return (
    <main className={`page-wrap ac ${className}`}>
      <span className="ac-aurora" aria-hidden />
      <span className="ac-grid-bg" aria-hidden />
      {children}
    </main>
  );
}

export function CommandHead({ crumb, title, sub, children }) {
  return (
    <header className="ac-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="ac-sub">{sub}</p> : null}
      </div>
      {children ? <div className="ac-head-tools">{children}</div> : null}
    </header>
  );
}

export function LiveChip({ label = "Board live" }) {
  return <span className="ac-live"><i /> {label}</span>;
}

export function Kpi({ icon: Icon, label, value, sub, meter, tone = "violet", onClick, active = false, locked = false, hot }) {
  const Tag = onClick ? "button" : "article";
  const tip = onClick ? (locked ? "Click again or press Esc to release this lens" : `Lock lens: ${label}${hot ? ` · key ${hot}` : ""}`) : undefined;
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`ac-kpi ${tone}${onClick ? " click" : ""}${active ? " on" : ""}${locked ? " locked" : ""}`}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      title={tip}
    >
      <span className="ac-kpi-edge" aria-hidden />
      {locked ? (
        <>
          <span className="ac-kpi-scan" aria-hidden />
          <i className="ac-kpi-br tl" aria-hidden />
          <i className="ac-kpi-br br" aria-hidden />
          <span className="ac-kpi-lock"><i />Lens</span>
        </>
      ) : hot ? (
        <kbd className="ac-kpi-key">{hot}</kbd>
      ) : null}
      <header>{Icon ? <span className="ac-kpi-ic"><Icon size={15} /></span> : null}<span>{label}</span></header>
      <strong>{value}</strong>
      {sub ? <p>{sub}</p> : null}
      {meter !== undefined ? <span className="ac-meter"><i style={{ width: `${Math.max(3, Math.min(100, meter))}%` }} /></span> : null}
    </Tag>
  );
}

/* ------------------------------------------------------------------
   Lens deck. The KPI row as one control: one tile at a time locks a
   lens on the list below (same pattern as the Audit Log). The base
   tile is home. Click a locked tile again, press Esc, or Release to
   go home. Keys 1–9 pick tiles. Tiles without an id are read-only.
------------------------------------------------------------------- */
export function LensDeck({ tiles, value, onChange, base = "all", readout }) {
  const lenses = tiles.filter((t) => t.id).map((t) => t.id);
  const pick = (id) => onChange(id === value && id !== base ? base : id);
  const pickRef = useRef(pick);
  useEffect(() => { pickRef.current = pick; });
  const key = lenses.join("|");

  useEffect(() => {
    const list = key.split("|");
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea"].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[aria-modal='true']")) return;
      if (e.key === "Escape") { pickRef.current(base); return; }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= list.length) pickRef.current(list[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, base]);

  const lit = value !== base ? tiles.find((t) => t.id === value) : null;

  return (
    <>
      <section className={`ac-kpis${lit ? " lensing" : ""}`}>
        {tiles.map(({ id, ...t }) => (
          <Kpi
            key={id || t.label}
            {...t}
            onClick={id ? () => pick(id) : undefined}
            active={Boolean(id) && id === value}
            locked={Boolean(lit) && id === value}
            hot={id ? lenses.indexOf(id) + 1 : undefined}
          />
        ))}
      </section>
      {lit ? (
        <div className={`ac-lensbar ${lit.tone || "violet"}`} role="status">
          <span className="ac-lensbar-ic">{lit.icon ? <lit.icon size={13} /> : null}</span>
          Lens locked <b>{lit.lens || lit.label}</b>
          {readout ? <><span className="sep" /><span className="read">{readout}</span></> : null}
          <button type="button" onClick={() => onChange(base)}>Release <kbd>Esc</kbd></button>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------
   Sort bar. Same control on every list page: pick a sort, click it
   again to flip the order. Each option: { id, label, dir, desc, asc }
   dir = default direction; desc / asc = how each direction reads
   ("most urgent first"). onChange(id, dir).
------------------------------------------------------------------- */
export function SortBar({ options, value, dir, onChange }) {
  const cur = options.find((o) => o.id === value);
  return (
    <div className="ac-sortbar">
      <span className="ac-sortlabel"><ArrowDownUp size={13} /> Sort</span>
      <div className="ac-seg small ac-sortseg" role="group" aria-label="Sort">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              className={on ? "on" : ""}
              aria-pressed={on}
              title={on ? "Click again to flip the order" : `Sort by ${o.label.toLowerCase()}`}
              onClick={() => onChange(o.id, on ? (dir === "asc" ? "desc" : "asc") : o.dir || "desc")}
            >
              {o.label}
              {on ? <i className={`ac-sortdir ${dir}`} aria-label={dir === "asc" ? "ascending" : "descending"}>↓</i> : null}
            </button>
          );
        })}
      </div>
      {cur ? (
        <span className="ac-sortread" key={`${value}-${dir}`}>
          <i />{dir === "asc" ? cur.asc || "Ascending" : cur.desc || "Descending"}
        </span>
      ) : null}
    </div>
  );
}

/* The value a row is being sorted by, so the order can be read at a glance. */
export function SortChip({ label, value, tone = "" }) {
  return <span className={`ac-sortchip ${tone}`}><em>{label}</em><b>{value}</b></span>;
}

export function RankBadge({ n }) {
  return <span className="ac-rank">#{String(n).padStart(2, "0")}</span>;
}

/* Glide reorder (FLIP). Items carry data-glide="<id>". Positions are
   read after every render; when `trigger` changes (sort or direction),
   each item slides from where it was to where it is now. */
export function useGlide(ref, trigger) {
  const prev = useRef(new Map());
  const last = useRef(trigger);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) { prev.current = new Map(); last.current = trigger; return; }
    const origin = box.getBoundingClientRect();
    const next = new Map();
    const items = [...box.querySelectorAll("[data-glide]")];
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      next.set(el.dataset.glide, { x: r.left - origin.left, y: r.top - origin.top });
    });
    const moved = last.current !== trigger;
    const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (moved && !calm && prev.current.size) {
      items.forEach((el, i) => {
        const a = prev.current.get(el.dataset.glide);
        const b = next.get(el.dataset.glide);
        if (!a || !b) return;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate?.(
          [{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 3 }, { transform: "none", zIndex: 3 }],
          { duration: 460, delay: Math.min(i * 14, 120), easing: "cubic-bezier(.22, 1, .36, 1)", fill: "backwards" }
        );
      });
    }
    prev.current = next;
    last.current = trigger;
  });
}

/* ------------------------------------------------------------------
   Hover scan. One pointer listener per list (not one per row). The
   item under the cursor ([data-fx]) gets .fx-on plus --mx/--my for a
   cursor-following light; with { tilt: true } it also gets --rx/--ry
   for a 3D tilt (cards only). Touch screens get nothing; reduced
   motion keeps the light but drops the tilt.
   Put <FxLayer /> inside each item to draw the light (+ brackets).
------------------------------------------------------------------- */
export function useHoverFx(ref, { tilt = false } = {}) {
  useEffect(() => {
    const box = ref.current;
    if (!box || typeof window === "undefined") return undefined;
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return undefined;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let lit = null;

    const off = (el) => {
      el.classList.remove("fx-on");
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    };
    // clear anything still lit (also covers a re-render between moves)
    const clear = (keep) => box.querySelectorAll(".fx-on").forEach((n) => { if (n !== keep) off(n); });
    const move = (e) => {
      const el = e.target.closest?.("[data-fx]");
      lit = el && box.contains(el) ? el : null;
      clear(lit);
      if (!lit) return;
      const { clientX, clientY } = e;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!lit) return;
        const r = lit.getBoundingClientRect();
        const x = clientX - r.left;
        const y = clientY - r.top;
        lit.style.setProperty("--mx", `${x.toFixed(1)}px`);
        lit.style.setProperty("--my", `${y.toFixed(1)}px`);
        lit.classList.add("fx-on");
        if (tilt && !calm) {
          lit.style.setProperty("--rx", `${((0.5 - y / r.height) * 8).toFixed(2)}deg`);
          lit.style.setProperty("--ry", `${((x / r.width - 0.5) * 10).toFixed(2)}deg`);
        }
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      lit = null;
      clear(null);
    };

    box.addEventListener("pointermove", move);
    box.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerleave", leave);
    };
  });
}

/* The light (and optional corner brackets) inside a hover-scan item. */
export function FxLayer({ brackets = false }) {
  return (
    <span className="ac-fx" aria-hidden>
      {brackets ? <><i className="tl" /><i className="br" /></> : null}
    </span>
  );
}

export function Panel({ kicker, title, icon: Icon, action, children, className = "", flush = false }) {
  return (
    <section className={`ac-panel ${className}`}>
      <i className="ac-hud tl" aria-hidden /><i className="ac-hud br" aria-hidden />
      {(kicker || title || action) && (
        <header className="ac-panel-head">
          <div>
            {kicker ? <p className="ac-kicker">{Icon ? <Icon size={12} /> : null}{kicker}</p> : null}
            {title ? <h3>{title}</h3> : null}
          </div>
          {action ? <div className="ac-panel-act">{action}</div> : null}
        </header>
      )}
      <div className={flush ? "ac-panel-body flush" : "ac-panel-body"}>{children}</div>
    </section>
  );
}

export function Seg({ options, value, onChange, small = false, label }) {
  return (
    <div className={`ac-seg${small ? " small" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
          {o.count !== undefined ? <em>{o.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function Chips({ items, value, onChange, tone = "" }) {
  return (
    <div className={`ac-chips ${tone}`}>
      {items.map((it) => (
        <button key={it.id} type="button" className={`${value === it.id ? "on" : ""}${it.tone ? ` t-${it.tone}` : ""}`} onClick={() => onChange(it.id)}>
          {it.icon ? <it.icon size={12} /> : null}
          {it.label}
          {it.count !== undefined ? <em>{it.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search" }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && !["input", "select", "textarea"].includes(tag) && !document.querySelector("[aria-modal='true']")) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <label className="ac-search">
      <Search size={15} />
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"><X size={13} /></button>
      ) : (
        <kbd>/</kbd>
      )}
    </label>
  );
}

export function Select({ value, onChange, options, label }) {
  return (
    <label className="ac-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function ResultLine({ total, of, page, size, noun }) {
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  return (
    <p className="ac-result">
      <span className="ac-result-dot" />
      {total === of ? `${of} ${noun}` : `${total} of ${of} ${noun} match`}
      {total > 0 && <b>· showing {from}–{to}</b>}
    </p>
  );
}

function pageWindow(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push("gap-l");
  for (let n = from; n <= to; n += 1) out.push(n);
  if (to < pages - 1) out.push("gap-r");
  out.push(pages);
  return out;
}

export function Pager({ page, pages, total, size, onPage, onSize, sizes = [6, 10, 15] }) {
  // change page, then bring the top of the results back into view
  const go = (n) => {
    const next = Math.min(Math.max(1, n), pages);
    if (next === page) return;
    onPage(next);
    requestAnimationFrame(() => document.querySelector(".ac-result")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; });

  // ← → flip pages when nothing is focused and no panel is open
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea"].includes(tag) || document.querySelector("[aria-modal='true']")) return;
      if (e.key === "ArrowRight") goRef.current(page + 1);
      if (e.key === "ArrowLeft") goRef.current(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page]);

  if (!total) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const progress = pages > 1 ? ((page - 1) / (pages - 1)) * 100 : 100;
  // one page and nothing to resize: no pager at all
  if (total <= Math.min(...sizes)) return null;
  return (
    <nav className="ac-pager" aria-label="Pages">
      <div className="ac-pager-read">
        <span>{String(from).padStart(2, "0")}–{String(to).padStart(2, "0")}</span>
        <em>of {total}</em>
      </div>
      <div className="ac-pager-core">
        <button type="button" className="step" onClick={() => go(1)} disabled={page === 1} aria-label="First page"><ChevronsLeft size={15} /></button>
        <button type="button" className="step" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={15} /></button>
        <div className="nums">
          {pageWindow(page, pages).map((n) =>
            typeof n === "number" ? (
              <button key={n} type="button" className={n === page ? "on" : ""} aria-current={n === page ? "page" : undefined} onClick={() => go(n)}>
                {String(n).padStart(2, "0")}
              </button>
            ) : (
              <span key={n} className="gap">···</span>
            )
          )}
        </div>
        <button type="button" className="step" onClick={() => go(page + 1)} disabled={page === pages} aria-label="Next page"><ChevronRight size={15} /></button>
        <button type="button" className="step" onClick={() => go(pages)} disabled={page === pages} aria-label="Last page"><ChevronsRight size={15} /></button>
        <span className="track" aria-hidden><i style={{ width: `${progress}%` }} /></span>
      </div>
      <div className="ac-pager-size">
        <span>Per page</span>
        <Seg small options={sizes.map((n) => ({ id: n, label: String(n) }))} value={size} onChange={onSize} />
        <kbd title="Use the arrow keys to flip pages">← →</kbd>
      </div>
    </nav>
  );
}

export function CatGlyph({ category, size = 34 }) {
  const meta = CAT_META[category] || CAT_META.other;
  const Icon = meta.icon;
  return (
    <span className="ac-cat" style={{ "--c": meta.color, width: size, height: size }} title={CATEGORY_LABEL[category] || category}>
      <Icon size={Math.round(size * 0.47)} />
    </span>
  );
}

export function StatusPill({ status }) {
  return <span className={`ac-st st-${status}`}><i />{STATUS_LABEL[status] || status}</span>;
}

export function PriorityPill({ priority }) {
  return <span className={`ac-pr pr-${priority}`}>{PRIORITY_LABEL[priority] || priority}</span>;
}

export function SlaMeter({ issue, compact = false }) {
  const sla = slaOf(issue);
  if (sla.state === "none") return compact ? null : <span className="ac-sla none">No window</span>;
  return (
    <span className={`ac-sla ${sla.state}${compact ? " compact" : ""}`} title={`Service window ${sla.total}h`}>
      <Hourglass size={11} />
      <b>{compact ? sla.short : sla.label}</b>
      {!compact && sla.state !== "closed" ? <span className="bar"><i style={{ width: `${sla.pct}%` }} /></span> : null}
    </span>
  );
}

export function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "—";
}

export function Avatar({ name, size = 36, tone = "violet", dot }) {
  return (
    <span className={`ac-avatar ${tone}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}>
      <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 4" /></svg>
      <b>{initials(name)}</b>
      {dot !== undefined ? <i className={dot ? "on" : ""} /> : null}
    </span>
  );
}

export function Empty({ icon: Icon, title, sub }) {
  return (
    <div className="ac-empty">
      {Icon ? <span><Icon size={20} /></span> : null}
      <strong>{title}</strong>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}

// "just now" / "5m ago" / "3h ago" / "2d ago"
export function ago(iso) {
  if (!iso) return "—";
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 1 / 60) return "just now";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
