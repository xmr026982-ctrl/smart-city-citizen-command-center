import { useNavigate } from "react-router-dom";
import { Users, Bell, BellRing, Check, ArrowUpRight } from "lucide-react";
import "../../../styles/follow.css";
import { meToo, toggleFollow, isFollowing, isSupporter, isReporter, affected } from "../../../services/citizenService";

/* ------------------------------------------------------------------
   Following someone else's report (citizens). Two levels:
     Affects me too   adds you to the "citizens affected" count the city
                      sees, and you follow it from then on. Can't be undone
                      (the count is what moves a report up the queue).
     Follow           updates only: the count doesn't change, undo any time.
   Either way the report shows in Saved and its updates arrive in
   Notifications under Following. Used on the Community board and on the
   map's public issue card. Never shows on your own report.
------------------------------------------------------------------- */
export default function FollowBar({ issue, user, compact = false, onDone }) {
  const navigate = useNavigate();
  if (!issue || !user || user.role !== "citizen" || isReporter(issue, user)) return null;
  const supporter = isSupporter(issue, user);
  const following = supporter || isFollowing(issue, user);
  const open = issue.status !== "resolved" && !issue.removed;
  const people = affected(issue);

  const affects = () => {
    const r = meToo(issue.id, user);
    if (onDone) onDone(r.ok ? "You're on it · the city sees one more person affected" : r.reason);
  };
  const follow = () => {
    toggleFollow(issue.id, user);
    if (onDone) onDone(following ? "Unfollowed · no more updates on this one" : "Following · updates arrive in Notifications");
  };

  return (
    <div className={`fbar${compact ? " compact" : ""}`}>
      <span className="fbar-n" title="The reporter plus everyone who said it affects them">
        <Users size={13} aria-hidden /><b>{people}</b> {people === 1 ? "citizen" : "citizens"} affected
      </span>
      <div className="fbar-acts">
        {open ? (
          supporter ? (
            <span className="fbar-btn done"><Check size={13} aria-hidden /> Affects you</span>
          ) : (
            <button type="button" className="fbar-btn go" onClick={affects} title="Adds you to the count the city sees, and you follow it">
              <Users size={13} aria-hidden /> Affects me too
            </button>
          )
        ) : null}
        {supporter ? null : (
          <button type="button" className={`fbar-btn${following ? " on" : ""}`} aria-pressed={following} onClick={follow} title={following ? "Stop getting updates" : "Get updates, without adding to the count"}>
            {following ? <><BellRing size={13} aria-hidden /> Following</> : <><Bell size={13} aria-hidden /> Follow</>}
          </button>
        )}
        {following ? (
          <button type="button" className="fbar-btn ghost" onClick={() => navigate(`/citizen/issues/${encodeURIComponent(issue.id)}`)}>
            Open <ArrowUpRight size={13} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
