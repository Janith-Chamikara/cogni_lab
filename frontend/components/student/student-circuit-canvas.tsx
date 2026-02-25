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
  BackgroundVariant,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { StudentEquipmentNode } from "./student-equipment-node";

const nodeTypes: NodeTypes = {
  equipment: StudentEquipmentNode as any,
};

export type PlacedEquipment = {
  id: string;
  equipmentId: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  equipment: any;
  configJson?: Record<string, unknown> | null;
};

type CircuitCanvasProps = {
  placedEquipments: PlacedEquipment[];
  wireConnections: any[];
  onEquipmentMove: (index: number, x: number, y: number) => void;
  onEquipmentRemove: (index: number) => void;
  onConnectionsChange: (connections: any[]) => void;
  onEquipmentDrop: (equipmentId: string, x: number, y: number) => void;
  isWireMode: boolean;
};

function CircuitCanvasInner({
  placedEquipments,
  wireConnections,
  onEquipmentMove,
  onEquipmentRemove,
  onConnectionsChange,
  onEquipmentDrop,
  isWireMode,
}: CircuitCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
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
          isWireMode,
        },
        draggable: !isWireMode,
      })),
    [placedEquipments, onEquipmentRemove, isWireMode],
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
        style: {
          stroke: conn.wireColor || "#22c55e",
          strokeWidth: 3,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: conn.wireColor || "#22c55e",
        },
        animated: true,
      })),
    [wireConnections],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when placedEquipments or isWireMode change
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
          isWireMode,
        },
        draggable: !isWireMode,
      })),
    );
  }, [placedEquipments, setNodes, onEquipmentRemove, isWireMode]);

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
        style: {
          stroke: conn.wireColor || "#22c55e",
          strokeWidth: 3,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: conn.wireColor || "#22c55e",
        },
        animated: true,
      })),
    );
  }, [wireConnections, setEdges]);

  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      const equipment = placedEquipments.find((eq) => eq.id === node.id);
      if (equipment) {
        const index = placedEquipments.indexOf(equipment);
        onEquipmentMove(index, node.position.x, node.position.y);
      }
    },
    [placedEquipments, onEquipmentMove],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isWireMode) return;
      
      const newConnection = {
        id: `conn-${Date.now()}`,
        sourceEquipmentId: connection.source,
        targetEquipmentId: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        wireColor: "#22c55e",
      };

      onConnectionsChange([...wireConnections, newConnection]);
    },
    [isWireMode, wireConnections, onConnectionsChange],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (isWireMode) {
        const updatedConnections = wireConnections.filter((conn) => {
          const edgeId = conn.id || `edge-${wireConnections.indexOf(conn)}`;
          return edgeId !== edge.id;
        });
        onConnectionsChange(updatedConnections);
      }
    },
    [isWireMode, wireConnections, onConnectionsChange],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      const equipmentId = e.dataTransfer.getData("application/equipment");
      if (!equipmentId || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: e.clientX - reactFlowBounds.left,
        y: e.clientY - reactFlowBounds.top,
      });

      onEquipmentDrop(equipmentId, position.x, position.y);
    },
    [screenToFlowPosition, onEquipmentDrop],
  );

  return (
    <div ref={reactFlowWrapper} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode={null}
        snapToGrid
        snapGrid={[15, 15]}
        connectionLineStyle={{
          stroke: isWireMode ? "#22c55e" : "#94a3b8",
          strokeWidth: 2,
        }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-background"
        />
      </ReactFlow>
    </div>
  );
}

export function StudentCircuitCanvas(props: CircuitCanvasProps) {
  return (
    <ReactFlowProvider>
      <CircuitCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
