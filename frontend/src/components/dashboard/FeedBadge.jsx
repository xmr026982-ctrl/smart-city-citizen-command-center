import { useEffect, useState } from "react";
import { useLiveFeed } from "../../hooks/useLiveFeed";

const LABEL = { simulated: "Simulated feed", live: "Live", offline: "Offline" };

function FeedBadge() {
  const feed = useLiveFeed();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sec = Math.max(0, Math.round((now - feed.updatedAt) / 1000));
  return (
    <div className="feed-badge" data-mode={feed.mode}>
      <i />
      {LABEL[feed.mode] || "Feed"}
      <em>updated {sec}s ago</em>
    </div>
  );
}

export default FeedBadge;