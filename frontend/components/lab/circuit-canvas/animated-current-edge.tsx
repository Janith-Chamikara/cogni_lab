"use client";

import { BaseEdge, getSmoothStepPath, EdgeProps } from "@xyflow/react";

export function AnimatedCurrentEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = (style?.stroke as string) || "#374151";

  return (
    <>
      {/* Glow effect for selected edge */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          strokeOpacity={0.3}
          className="animate-pulse"
          style={{ filter: "blur(4px)" }}
        />
      )}
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
        }}
        markerEnd={markerEnd}
      />
      {/* Animated current flow circle */}
      <circle r="2" fill={strokeColor}>
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
      {/* Second animated circle for denser flow effect */}
      <circle r="2" fill={strokeColor}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={edgePath}
          begin="0.75s"
        />
      </circle>
    </>
  );
}
