"use client";

import { useCallback, useSyncExternalStore } from "react";

// A boolean UI preference (e.g. "sidebar open") remembered in this browser.
// The server render uses `initial`; the client then reads localStorage.
// Storage errors (private mode, blocked storage) fall back to `initial`.

const CHANGE_EVENT = "cognilab:persistent-flag";
// Used when localStorage is unavailable, so toggles still work this visit.
const memory = new Map<string, boolean>();

const read = (key: string): boolean | null => {
  try {
    const saved = window.localStorage.getItem(key);
    return saved === "true" ? true : saved === "false" ? false : null;
  } catch {
    return memory.get(key) ?? null;
  }
};

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
};

export function usePersistentFlag(key: string, initial: boolean) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? initial,
    () => initial,
  );

  const update = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const current = read(key) ?? initial;
      const resolved = typeof next === "function" ? next(current) : next;
      try {
        window.localStorage.setItem(key, String(resolved));
      } catch {
        memory.set(key, resolved);
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, initial],
  );

  return [value, update] as const;
}
