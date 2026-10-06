"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Full-screen workspace mode for the lab editors. Uses browser full screen
 * when allowed; otherwise the editor still covers the window (the caller
 * renders it `fixed inset-0`). Esc or leaving browser full screen exits.
 */
export function useFocusMode() {
  const [isFocusMode, setIsFocusMode] = useState(false);

  const toggleFocusMode = useCallback(async () => {
    if (isFocusMode) {
      setIsFocusMode(false);
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      return;
    }
    setIsFocusMode(true);
    await document.documentElement.requestFullscreen?.().catch(() => {});
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) return;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setIsFocusMode(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        setIsFocusMode(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFocusMode]);

  return { isFocusMode, toggleFocusMode };
}

/** Root classes for an editor page: full width below the navbar, or full screen. */
export const editorRootClass = (isFocusMode: boolean) =>
  isFocusMode
    ? // Full screen: cover the site navbar too.
      "fixed inset-0 z-[45] flex flex-col bg-background"
    : // Full width, filling the window below the 57px navbar.
      "flex h-[calc(100dvh-57px)] w-full flex-col overflow-hidden bg-background";
