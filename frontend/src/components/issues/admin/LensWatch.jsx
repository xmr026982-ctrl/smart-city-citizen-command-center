import { useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Panel, CatGlyph, PriorityPill, StatusPill, SlaMeter, Empty, FxLayer, useHoverFx } from "./CommandKit";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { slaOf } from "../../../utils/sla";
import "../../../styles/lens-watch.css";

/* ------------------------------------------------------------------
   Lens watch: the issues behind a locked KPI lens (Issue Command,
   Service Windows, Analytics). Slides in under the tile deck with a
   scan line; each issue opens its file. `side` adds a readout on the
   right of a row (e.g. time to resolve); `max` caps the list;
   `action` puts a control in the panel head (e.g. a jump to Assign).
------------------------------------------------------------------- */

function LensWatch({ kicker, icon, title, items, empty, emptyIcon, onOpen, onRelease, action, side, max = 8, more, tone = "" }) {
  const ref = useRef(null);
  useHoverFx(ref);
  return (
    <Panel
      className={`lw ${tone}`}
      kicker={kicker}
      icon={icon}
      title={title}
      action={action || (onRelease ? <button type="button" className="ac-btn sm" onClick={onRelease}><X size={12} /> Release · Esc</button> : null)}
    >
      {!items.length ? (
        <Empty icon={emptyIcon || icon} title={empty} sub="Nothing on this lens right now." />
      ) : (
        <div className="lw-list" ref={ref} key={title}>
          {items.slice(0, max).map((i, n) => {
            const st = i.status === "resolved" ? "closed" : slaOf(i).state;
            return (
              <button key={i.id} type="button" data-fx className={`lw-row st-${st}`} style={{ animationDelay: `${n * 35}ms` }} onClick={() => onOpen(i.id)}>
                <FxLayer />
                <CatGlyph category={i.category} size={34} />
                <div className="lw-main">
                  <p><span className="ac-id">{i.id}</span> · {i.ward} · {CATEGORY_LABEL[i.category] || i.category}</p>
                  <b>{i.title}</b>
                  <div className="lw-meta">
                    <StatusPill status={i.status} />
                    <PriorityPill priority={i.priority} />
                    {i.status !== "resolved" ? <SlaMeter issue={i} /> : null}
                  </div>
                </div>
                <span className="lw-side">
                  {side ? <em>{side(i)}</em> : null}
                  <span className="lw-go">Open file <ArrowUpRight size={11} /></span>
                </span>
              </button>
            );
          })}
          {items.length > max ? <p className="lw-more">+{items.length - max} more on this lens{more ? ` · ${more}` : ""}</p> : null}
        </div>
      )}
    </Panel>
  );
}

export default LensWatch;