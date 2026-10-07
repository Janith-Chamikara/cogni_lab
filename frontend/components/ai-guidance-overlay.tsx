"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { visibleTargetRect, type GuidanceDisplay } from "@/lib/ai-guidance";

type Bounds = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };

const guidanceColors = {
  issue: {
    primary: "#ef4444",
    glow: "#dc2626",
    halo: "#fca5a5",
    panel: "border-red-400/50 shadow-red-500/20",
    title: "text-red-600 dark:text-red-400",
  },
  locate: {
    primary: "#3b82f6",
    glow: "#2563eb",
    halo: "#60a5fa",
    panel: "border-blue-400/50 shadow-blue-500/20",
    title: "text-blue-500",
  },
  navigate: {
    primary: "#22c55e",
    glow: "#16a34a",
    halo: "#86efac",
    panel: "border-green-400/50 shadow-green-500/20",
    title: "text-green-600 dark:text-green-400",
  },
};

const issuePopupPosition = (bounds: Bounds, popup: Size, viewport: Size) => {
  const margin = 12;
  const gap = 24;
  const clamp = (value: number, size: number, limit: number) =>
    Math.max(margin, Math.min(value, limit - size - margin));
  const centeredLeft = clamp(
    bounds.left + (bounds.width - popup.width) / 2,
    popup.width,
    viewport.width,
  );
  const centeredTop = clamp(
    bounds.top + (bounds.height - popup.height) / 2,
    popup.height,
    viewport.height,
  );
  const candidates = [
    { left: bounds.left + bounds.width + gap, top: centeredTop },
    { left: bounds.left - popup.width - gap, top: centeredTop },
    { left: centeredLeft, top: bounds.top + bounds.height + gap },
    { left: centeredLeft, top: bounds.top - popup.height - gap },
  ];
  const fits = candidates.find(
    ({ left, top }) =>
      left >= margin &&
      top >= margin &&
      left + popup.width <= viewport.width - margin &&
      top + popup.height <= viewport.height - margin,
  );
  if (fits) return fits;

  // On narrow screens, use the candidate that covers the least of the target.
  const clamped = candidates.map(({ left, top }) => ({
    left: clamp(left, popup.width, viewport.width),
    top: clamp(top, popup.height, viewport.height),
  }));
  const overlap = ({ left, top }: { left: number; top: number }) =>
    Math.max(
      0,
      Math.min(left + popup.width, bounds.left + bounds.width) -
        Math.max(left, bounds.left),
    ) *
    Math.max(
      0,
      Math.min(top + popup.height, bounds.top + bounds.height) -
        Math.max(top, bounds.top),
    );
  return clamped.reduce((best, next) =>
    overlap(next) < overlap(best) ? next : best,
  );
};

const circlePath = (bounds: Bounds) => {
  const cx = bounds.left + bounds.width / 2,
    cy = bounds.top + bounds.height / 2;
  const rx = bounds.width / 2 + 12,
    ry = bounds.height / 2 + 12;
  return Array.from({ length: 101 }, (_, index) => {
    const angle = (index / 100) * Math.PI * 2.08;
    const wobble =
      1 + 0.025 * Math.sin(angle * 5) + 0.015 * Math.cos(angle * 9);
    return `${index === 0 ? "M" : "L"}${(cx + Math.cos(angle) * rx * wobble).toFixed(1)},${(cy + Math.sin(angle) * ry * wobble).toFixed(1)}`;
  }).join(" ");
};

export function AiGuidanceOverlay({ route }: { route: string }) {
  const [display, setDisplay] = useState<GuidanceDisplay | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [popupSize, setPopupSize] = useState<Size>({ width: 288, height: 120 });
  const popupRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<GuidanceDisplay | null>(null);
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    const receive = (event: Event) => {
      cancelRef.current();
      const next = (event as CustomEvent<GuidanceDisplay>).detail;
      if (!next || next.signal.aborted) {
        next?.complete(false);
        return;
      }
      activeRef.current = next;
      setBounds(null);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setDisplay(next);
    };
    window.addEventListener("cogni-ai-guidance", receive);
    const clear = () => cancelRef.current();
    window.addEventListener("cogni-ai-guidance-clear", clear);
    return () => {
      window.removeEventListener("cogni-ai-guidance", receive);
      window.removeEventListener("cogni-ai-guidance-clear", clear);
      cancelRef.current();
    };
  }, [route]);

  useEffect(() => {
    if (display?.plan.purpose !== "issue" || !popupRef.current) return;
    const popup = popupRef.current;
    const observer = new ResizeObserver(() => {
      const { width, height } = popup.getBoundingClientRect();
      setPopupSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(popup);
    return () => observer.disconnect();
  }, [display]);

  useEffect(() => {
    if (!display) return;
    let frame = 0,
      finished = false;
    const started = performance.now();
    let previous: Bounds | null = null;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    const cancel = () => {
      cancelAnimationFrame(frame);
      if (!finished) {
        finished = true;
        display.complete(false);
      }
      if (activeRef.current === display) {
        activeRef.current = null;
        setDisplay(null);
        setBounds(null);
      }
    };
    cancelRef.current = cancel;
    const track = () => {
      if (display.signal.aborted || !display.element.isConnected) {
        cancel();
        return;
      }
      const current = visibleTargetRect(display.element);
      if (
        viewportWidth !== window.innerWidth ||
        viewportHeight !== window.innerHeight
      ) {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        setViewport({ width: viewportWidth, height: viewportHeight });
      }
      const elapsed = performance.now() - started;
      if (current) {
        if (
          !previous ||
          Object.keys(current).some(
            (key) =>
              Math.abs(
                current[key as keyof Bounds] - previous![key as keyof Bounds],
              ) > 0.5,
          )
        ) {
          previous = current;
          setBounds(current);
        }
        if (!finished && elapsed >= 1000) {
          finished = true;
          display.complete(true);
        }
      } else if (elapsed > 1200) {
        cancel();
        return;
      }
      if (elapsed >= (display.plan.mode === "click" ? 1800 : 8000)) {
        cancel();
        return;
      }
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", key);
    display.signal.addEventListener("abort", cancel, { once: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key);
      display.signal.removeEventListener("abort", cancel);
      if (!finished) display.complete(false);
    };
  }, [display]);

  if (!display || typeof document === "undefined") return null;
  const cursorX = bounds
    ? bounds.left + Math.min(20, bounds.width / 2)
    : window.innerWidth - 80;
  const cursorY = bounds
    ? bounds.top + Math.min(20, bounds.height / 2)
    : window.innerHeight - 80;
  const arrowStartX = bounds ? Math.max(24, bounds.left - 65) : 0;
  const arrowStartY = bounds ? Math.max(24, bounds.top - 65) : 0;
  const isIssue = display.plan.purpose === "issue";
  const colors = guidanceColors[display.plan.purpose];
  const popupPosition =
    isIssue && bounds
      ? issuePopupPosition(bounds, popupSize, viewport)
      : undefined;
  return createPortal(
    <div
      data-ai-guidance-overlay=""
      className="pointer-events-none fixed inset-0 z-[80]"
      aria-label="Assistant visual guidance"
    >
      <style>{`@keyframes cogni-guide-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes cogni-guide-pulse{0%,100%{opacity:.55}50%{opacity:1}}@media(prefers-reduced-motion:reduce){.cogni-guide-drawing{animation:none!important}.cogni-guide-cursor{transition:none!important}}`}</style>
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        className="absolute inset-0 overflow-visible"
        style={{ filter: `drop-shadow(0 0 6px ${colors.primary})` }}
      >
        <defs>
          <marker
            id="cogni-guidance-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path
              d="M0 0 L8 4 L0 8"
              fill="none"
              stroke={colors.primary}
              strokeWidth="1.6"
            />
          </marker>
        </defs>
        {bounds &&
          (display.plan.mode === "circle" ? (
            <path
              className="cogni-guide-drawing"
              d={circlePath(bounds)}
              pathLength={1}
              fill="none"
              stroke={colors.primary}
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                strokeDasharray: 1,
                animation: "cogni-guide-draw .65s .35s both",
              }}
            />
          ) : display.plan.mode === "arrow" ? (
            <path
              className="cogni-guide-drawing"
              d={`M${arrowStartX},${arrowStartY} Q${arrowStartX},${bounds.top + bounds.height / 2} ${bounds.left + 4},${bounds.top + bounds.height / 2}`}
              pathLength={1}
              fill="none"
              stroke={colors.primary}
              strokeWidth="3"
              markerEnd="url(#cogni-guidance-arrow)"
              style={{
                strokeDasharray: 1,
                animation: "cogni-guide-draw .65s .35s both",
              }}
            />
          ) : (
            <rect
              x={bounds.left - 5}
              y={bounds.top - 5}
              width={bounds.width + 10}
              height={bounds.height + 10}
              rx="10"
              fill={colors.primary}
              fillOpacity=".08"
              stroke={colors.primary}
              strokeWidth="2.5"
              style={{ animation: "cogni-guide-pulse 1.4s infinite" }}
            />
          ))}
      </svg>
      <svg
        aria-hidden="true"
        className="cogni-guide-cursor absolute overflow-visible"
        width="28"
        height="34"
        viewBox="-3 -3 30 39"
        style={{
          left: cursorX,
          top: cursorY,
          transition: "left .45s ease, top .45s ease",
          filter: `drop-shadow(0 0 8px ${colors.glow}) drop-shadow(0 0 16px ${colors.halo})`,
        }}
      >
        <path
          d="M0 0 L0 25 L7 19 L12 30 L17 28 L12 17 L22 17 Z"
          fill={colors.primary}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <div
        ref={popupRef}
        className={`absolute rounded-xl border bg-background/95 px-4 py-3 text-sm text-foreground shadow-lg ${colors.panel} ${
          isIssue
            ? "pointer-events-auto w-[min(288px,calc(100vw-24px))] overflow-y-auto"
            : "bottom-24 left-1/2 w-[min(360px,calc(100vw-32px))] -translate-x-1/2"
        }`}
        style={
          isIssue
            ? {
                left: popupPosition?.left ?? 12,
                top: popupPosition?.top ?? 12,
                maxHeight: "calc(100dvh - 24px)",
                visibility: popupPosition ? "visible" : "hidden",
              }
            : undefined
        }
        role="status"
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium ${colors.title}`}>
            {isIssue
              ? "Circuit issue"
              : `${display.plan.mode === "click" ? "Opening" : "Showing"} ${display.label}`}
          </span>
          <button
            type="button"
            onClick={() => cancelRef.current()}
            className="pointer-events-auto shrink-0 rounded px-2 py-1 text-xs hover:bg-muted"
            aria-label="Dismiss visual guidance"
          >
            Dismiss
          </button>
        </div>
        {isIssue && (
          <p className="mt-1 truncate text-xs font-medium" title={display.label}>
            {display.label}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {display.plan.reason}
        </p>
      </div>
    </div>,
    document.body,
  );
}
