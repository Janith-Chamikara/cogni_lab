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
  Handle,
  Position,
  BackgroundVariant,
  ConnectionLineType,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Image from "next/image";
import { ImageIcon, Settings, Trash2, Cable } from "lucide-react";
import { EquipmentPlacement, LabEquipment, WireConnection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId?: string | null) => {
  if (!publicId || !cloudinaryCloudName) {
    return null;
  }
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${publicId}`;
};

export type PlacedEquipment = EquipmentPlacement & {
  equipment: LabEquipment;
};

type CircuitCanvasProps = {
  placedEquipments: PlacedEquipment[];
  wireConnections: WireConnection[];
  onEquipmentMove: (index: number, x: number, y: number) => void;
  onEquipmentRemove: (index: number) => void;
  onEquipmentConfig: (index: number) => void;
  onConnectionsChange: (connections: WireConnection[]) => void;
  onEquipmentDrop: (equipmentId: string, x: number, y: number) => void;
};

// Equipment node component for React Flow
function EquipmentNode({
  data,
}: {
  data: {
    equipment: LabEquipment;
    index: number;
    onRemove: (index: number) => void;
    onConfig: (index: number) => void;
  };
}) {
  const imageUrl = getCloudinaryUrl(data.equipment.imageUrl);
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!h-3 !w-3 !rounded-full !border-2 !border-blue-500 !bg-background"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!h-3 !w-3 !rounded-full !border-2 !border-blue-500 !bg-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!h-3 !w-3 !rounded-full !border-2 !border-green-500 !bg-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!h-3 !w-3 !rounded-full !border-2 !border-green-500 !bg-background"
      />

      {/* Equipment card */}
      <div className="flex h-[120px] w-[120px] flex-col items-center justify-center rounded-lg border-2 border-border bg-card p-2 shadow-md transition-all hover:border-primary hover:shadow-lg">
        {imageUrl ? (
          <div className="relative h-16 w-16">
            <Image
              src={imageUrl}
              alt={data.equipment.equipmentName}
              fill
              className="object-contain"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <p className="mt-1 w-full truncate text-center text-xs font-medium text-foreground">
          {data.equipment.equipmentName}
        </p>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="absolute -top-2 right-0 flex gap-1">
          {data.equipment.supportsConfiguration && (
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                data.onConfig(data.index);
              }}
            >
              <Settings className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="destructive"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              data.onRemove(data.index);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  equipment: EquipmentNode,
};

// Wire colors for user selection
const WIRE_COLORS = [
  { name: "Gray", value: "#374151" },
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Black", value: "#000000" },
];

function CircuitCanvasInner({
  placedEquipments,
  wireConnections,
  onEquipmentMove,
  onEquipmentRemove,
  onEquipmentConfig,
  onConnectionsChange,
  onEquipmentDrop,
}: CircuitCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedWireColor, setSelectedWireColor] = useState(
    WIRE_COLORS[0].value,
  );
  const [isWireMode, setIsWireMode] = useState(false);
  const theme = useTheme();

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
        sourceHandle: conn.sourceHandle || "right",
        targetHandle: conn.targetHandle || "left",
        type: "smoothstep",
        animated: false,
        style: {
          stroke: conn.wireColor || "#374151",
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: conn.wireColor || "#374151",
        },
      })),
    [wireConnections],
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
        sourceHandle: conn.sourceHandle || "right",
        targetHandle: conn.targetHandle || "left",
        type: "smoothstep",
        animated: false,
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
  }, [wireConnections, setEdges]);

  // Handle new wire connection
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const newEdge: Edge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: "smoothstep",
        animated: false,
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
      const remainingConnections = wireConnections.filter(
        (conn) => !deletedIds.has(conn.id || ""),
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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
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
          <div className="flex items-center gap-2 border-l pl-4">
            <span className="text-sm text-muted-foreground">Wire Color:</span>
            <div className="flex gap-1">
              {WIRE_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${
                    selectedWireColor === color.value
                      ? "border-foreground ring-2 ring-ring"
                      : "border-transparent hover:border-muted-foreground"
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setSelectedWireColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {isWireMode
            ? "Drag from a green handle to a blue handle to connect"
            : "Drag components to move them"}
        </div>
      </div>

      <div className="flex-1" ref={reactFlowWrapper}>
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
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionLineStyle={{ stroke: selectedWireColor, strokeWidth: 2 }}
          fitView
          colorMode={
            theme.theme === "dark"
              ? "dark"
              : theme.theme === "light"
                ? "light"
                : "system"
          }
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode={["Backspace", "Delete"]}
          className={isWireMode ? "cursor-crosshair" : ""}
        >
          <Controls className="bg-background text-foreground" />
          <MiniMap />
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
