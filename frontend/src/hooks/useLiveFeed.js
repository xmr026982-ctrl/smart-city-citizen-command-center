import { useSyncExternalStore } from "react";
import { getFeed, subscribeFeed } from "../services/liveFeed";

export function useLiveFeed() {
  return useSyncExternalStore(subscribeFeed, getFeed, getFeed);
}