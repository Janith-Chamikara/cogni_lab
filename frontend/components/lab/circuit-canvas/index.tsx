"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  EdgeTypes,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getTerminals, resolveHandleId } from "@/lib/circuit-terminals";
import { Cable } from "lucide-react";
import { WireConnection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";

import { EquipmentNode } from "./equipment-node";
import { AnimatedCurrentEdge } from "./animated-current-edge";
import { WIRE_COLORS } from "./constants";
import { CircuitCanvasProps } from "./types";

// Re-export types for external use
export type { PlacedEquipment, CircuitCanvasProps } from "./types";

const nodeTypes: NodeTypes = {
  equipment: EquipmentNode,
};

const edgeTypes: EdgeTypes = {
  animatedCurrent: AnimatedCurrentEdge,
};

function CircuitCanvasInner({
  placedEquipments,
  wireConnections,
  onEquipmentMove,
  onEquipmentRemove,
  onEquipmentConfig,
  onConnectionsChange,
  onEquipmentDrop,
  toolbarStart,
  toolbarEnd,
}: CircuitCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedWireColor, setSelectedWireColor] = useState(
    WIRE_COLORS[0].value,
  );
  const [isWireMode, setIsWireMode] = useState(false);
  const theme = useTheme();

  // Named terminals per node, so wires saved with legacy handle ids
  // (left/right/top/bottom) attach to the matching named handle.
  const terminalsById = useMemo(
    () =>
      new Map(
        placedEquipments.map((eq, index) => [
          eq.id || `temp-${index}`,
          getTerminals(eq.equipment),
        ]),
      ),
    [placedEquipments],
  );

  // Convert placed equipments to React Flow nodes
  const initialNodes: Node[] = useMemo(
    () =>
      placedEquipments.map((eq, index) => ({
        id: eq.id || `temp-${index}`,
        type: "equipment",
        position: { x: eq.positionX, y: eq.positionY },
        data: {
          equipment: eq.equipment,
          index,
          onRemove: onEquipmentRemove,
          onConfig: onEquipmentConfig,
        },
        draggable: !isWireMode,
      })),
    [placedEquipments, onEquipmentRemove, onEquipmentConfig, isWireMode],
  );

  // Convert wire connections to React Flow edges
  const initialEdges: Edge[] = useMemo(
    () =>
      wireConnections.map((conn, index) => ({
        id: conn.id || `edge-${index}`,
        source: conn.sourceEquipmentId,
        target: conn.targetEquipmentId,
        sourceHandle: resolveHandleId(
          terminalsById.get(conn.sourceEquipmentId) ?? null,
          conn.sourceHandle,
          "right",
        ),
        targetHandle: resolveHandleId(
          terminalsById.get(conn.targetEquipmentId) ?? null,
          conn.targetHandle,
          "left",
        ),
        type: "animatedCurrent",
        style: {
          stroke: conn.wireColor || "#374151",
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: conn.wireColor || "#374151",
        },
      })),
    [wireConnections, terminalsById],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when placedEquipments change
  useMemo(() => {
    setNodes(
      placedEquipments.map((eq, index) => ({
        id: eq.id || `temp-${index}`,
        type: "equipment",
        position: { x: eq.positionX, y: eq.positionY },
        data: {
          equipment: eq.equipment,
          index,
          onRemove: onEquipmentRemove,
          onConfig: onEquipmentConfig,
        },
        draggable: !isWireMode,
      })),
    );
  }, [
    placedEquipments,
    setNodes,
    onEquipmentRemove,
    onEquipmentConfig,
    isWireMode,
  ]);

  // Update edges when wireConnections change
  useMemo(() => {
    setEdges(
      wireConnections.map((conn, index) => ({
        id: conn.id || `edge-${index}`,
        source: conn.sourceEquipmentId,
        target: conn.targetEquipmentId,
        sourceHandle: resolveHandleId(
          terminalsById.get(conn.sourceEquipmentId) ?? null,
          conn.sourceHandle,
          "right",
        ),
        targetHandle: resolveHandleId(
          terminalsById.get(conn.targetEquipmentId) ?? null,
          conn.targetHandle,
          "left",
        ),
        type: "animatedCurrent",
        style: {
          stroke: conn.wireColor || "#374151",
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: conn.wireColor || "#374151",
        },
      })),
    );
  }, [wireConnections, setEdges, terminalsById]);

  // Handle new wire connection
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const newEdge: Edge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: "animatedCurrent",
        style: {
          stroke: selectedWireColor,
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: selectedWireColor,
        },
      } as Edge;

      setEdges((eds) => addEdge(newEdge, eds));

      // Update wire connections for parent
      const newConnection: WireConnection = {
        sourceEquipmentId: params.source,
        targetEquipmentId: params.target,
        sourceHandle: params.sourceHandle || "right",
        targetHandle: params.targetHandle || "left",
        wireColor: selectedWireColor,
      };

      onConnectionsChange([...wireConnections, newConnection]);
    },
    [selectedWireColor, setEdges, wireConnections, onConnectionsChange],
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const deletedIds = new Set(deletedEdges.map((e) => e.id));
      // Unsaved wires have no id; their edges use "edge-<index>".
      const remainingConnections = wireConnections.filter(
        (conn, index) => !deletedIds.has(conn.id || `edge-${index}`),
      );
      onConnectionsChange(remainingConnections);
    },
    [wireConnections, onConnectionsChange],
  );

  // Handle node position change (drag end)
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const index = placedEquipments.findIndex(
        (eq) => (eq.id || `temp-${placedEquipments.indexOf(eq)}`) === node.id,
      );
      if (index !== -1) {
        onEquipmentMove(
          index,
          Math.round(node.position.x),
          Math.round(node.position.y),
        );
      }
    },
    [placedEquipments, onEquipmentMove],
  );

  // Handle drag over for external drops
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle external equipment drop
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const equipmentId = event.dataTransfer.getData("application/equipment");
      if (!equipmentId) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onEquipmentDrop(
        equipmentId,
        Math.round(position.x),
        Math.round(position.y),
      );
    },
    [screenToFlowPosition, onEquipmentDrop],
  );

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5">
        {toolbarStart}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isWireMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsWireMode(!isWireMode)}
                className="gap-2"
              >
                <Cable className="h-4 w-4" />
                Wire Mode
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isWireMode
                ? "Click to disable wire mode and move components"
                : "Click to enable wire mode and connect components"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isWireMode && (
          <div className="flex items-center gap-1 border-l pl-3">
            {WIRE_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`h-5 w-5 rounded-full border-2 transition-all ${
                  selectedWireColor === color.value
                    ? "border-foreground ring-2 ring-ring"
                    : "border-transparent hover:border-muted-foreground"
                }`}
                style={{ backgroundColor: color.value }}
                onClick={() => setSelectedWireColor(color.value)}
                title={`Wire colour: ${color.name}`}
              />
            ))}
          </div>
        )}

        <p className="ml-2 hidden min-w-0 flex-1 truncate text-xs text-muted-foreground lg:block">
          {isWireMode
            ? "Drag from one terminal to another to connect. Select a wire and press Delete to remove it."
            : "Drag equipment onto the canvas. Hover a part to configure or remove it."}
        </p>

        {toolbarEnd && (
          <div className="ml-auto flex items-center gap-1">{toolbarEnd}</div>
        )}
      </div>

      <div className="relative min-h-0 flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          // Named terminals are all "source" handles; any terminal may
          // connect to any other (e.g. R1.1 to R2.1 for parallel wiring).
          connectionMode={ConnectionMode.Loose}
          isValidConnection={(conn) =>
            !(
              conn.source === conn.target &&
              conn.sourceHandle === conn.targetHandle
            )
          }
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{ stroke: selectedWireColor, strokeWidth: 2 }}
          fitView
          // resolvedTheme is what the page actually shows ("system" resolved).
          colorMode={theme.resolvedTheme === "dark" ? "dark" : "light"}
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode={["Backspace", "Delete"]}
          className={isWireMode ? "cursor-crosshair" : ""}
        >
          <Controls className="bg-background text-foreground" />
          {/* Top right: the chat button sits in the bottom-right corner. */}
          <MiniMap position="top-right" />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>

      {placedEquipments.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Drop equipment here</p>
            <p className="text-sm">
              Drag components from the sidebar to build your circuit
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function CircuitCanvas(props: CircuitCanvasProps) {
  return (
    <ReactFlowProvider>
      <CircuitCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
