import { useEffect, useState } from "react";

const KEY = "wardline-issue-draft";

export function useIssueDraft(initial) {
  const [draft, setDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(draft));
  }, [draft]);

  const clearDraft = () => {
    localStorage.removeItem(KEY);
    setDraft(initial);
  };

  return { draft, setDraft, clearDraft };
}