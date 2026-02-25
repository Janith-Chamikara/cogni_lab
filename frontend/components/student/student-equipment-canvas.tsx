"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Trash2, Zap, ZapOff } from "lucide-react";
import type { Lab, ExperimentStep, EquipmentPlacement, WireConnection } from "@/lib/types";
import { EquipmentInteractionDialog } from "./equipment-interaction-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

interface StudentEquipmentCanvasProps {
  lab: Lab;
  currentStep: ExperimentStep | undefined;
  onStepComplete: () => void;
}

type ConnectionMode = "view" | "connecting";
type StudentConnection = {
  id: string;
  sourceEquipmentId: string;
  targetEquipmentId: string;
};

export function StudentEquipmentCanvas({
  lab,
  currentStep,
}: StudentEquipmentCanvasProps) {
  const [selectedEquipment, setSelectedEquipment] = React.useState<any>(null);
  const [connectionMode, setConnectionMode] = React.useState<ConnectionMode>("view");
  const [sourceEquipment, setSourceEquipment] = React.useState<EquipmentPlacement | null>(null);
  const [studentConnections, setStudentConnections] = React.useState<StudentConnection[]>([]);
  const [hoveredEquipment, setHoveredEquipment] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);

  const equipments = lab.labEquipments || [];
  const connections = lab.wireConnections || [];
  
  // Combine preset connections with student-made connections
  const allConnections = React.useMemo(() => {
    return [...connections, ...studentConnections];
  }, [connections, studentConnections]);

  const handleEquipmentClick = (equipment: EquipmentPlacement) => {
    if (connectionMode === "connecting") {
      if (!sourceEquipment) {
        // Set as source
        setSourceEquipment(equipment);
      } else if (sourceEquipment.id !== equipment.id) {
        // Create connection
        const newConnection: StudentConnection = {
          id: `student-${Date.now()}`,
          sourceEquipmentId: sourceEquipment.equipmentId,
          targetEquipmentId: equipment.equipmentId,
        };
        setStudentConnections(prev => [...prev, newConnection]);
        setSourceEquipment(null);
        setConnectionMode("view");
      }
    } else {
      // View mode - open equipment dialog
      setSelectedEquipment(equipment);
    }
  };

  const handleStartConnection = () => {
    setConnectionMode("connecting");
    setSourceEquipment(null);
  };

  const handleCancelConnection = () => {
    setConnectionMode("view");
    setSourceEquipment(null);
  };

  const handleDeleteConnection = (connectionId: string) => {
    setStudentConnections(prev => prev.filter(c => c.id !== connectionId));
  };

  const handleClearAllConnections = () => {
    setStudentConnections([]);
  };

  return (
    <div className="relative w-full h-full bg-grid-pattern" ref={canvasRef}>
      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-50 space-y-2">
        <Card className="p-4 space-y-3 min-w-[250px]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Wire Connections</h3>
            <Badge variant={connectionMode === "connecting" ? "default" : "secondary"}>
              {connectionMode === "connecting" ? "Connecting" : "View Mode"}
            </Badge>
          </div>
          
          {connectionMode === "view" ? (
            <div className="space-y-2">
              <Button 
                onClick={handleStartConnection} 
                className="w-full" 
                size="sm"
                variant="default"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Connect Wires
              </Button>
              {studentConnections.length > 0 && (
                <Button 
                  onClick={handleClearAllConnections} 
                  className="w-full" 
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All ({studentConnections.length})
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {!sourceEquipment 
                    ? "Click on equipment to start connection" 
                    : "Click on another equipment to complete connection"}
                </AlertDescription>
              </Alert>
              <Button 
                onClick={handleCancelConnection} 
                className="w-full" 
                size="sm"
                variant="outline"
              >
                <ZapOff className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <p>Student Wires: {studentConnections.length}</p>
            <p>Preset Wires: {connections.length}</p>
          </div>
        </Card>
      </div>

      <div className="absolute inset-0 overflow-auto p-8">
        {/* Circuit Canvas Background */}
        <div className="relative min-h-full">
          {/* Draw Connections */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {allConnections.map((conn: any) => {
              const fromEquip = equipments.find(
                (e: EquipmentPlacement) => e.equipmentId === conn.sourceEquipmentId
              );
              const toEquip = equipments.find(
                (e: EquipmentPlacement) => e.equipmentId === conn.targetEquipmentId
              );

              if (!fromEquip || !toEquip) return null;

              const fromX = (fromEquip.positionX || 0) + 60;
              const fromY = (fromEquip.positionY || 0) + 60;
              const toX = (toEquip.positionX || 0) + 60;
              const toY = (toEquip.positionY || 0) + 60;
              
              const isStudentConnection = conn.id?.startsWith('student-');

              return (
                <g key={conn.id}>
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="currentColor"
                    strokeWidth="3"
                    className={isStudentConnection ? "text-green-500" : "text-blue-500"}
                    markerEnd="url(#arrowhead)"
                  />
                  {isStudentConnection && (
                    <>
                      <circle
                        cx={(fromX + toX) / 2}
                        cy={(fromY + toY) / 2}
                        r="12"
                        fill="white"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-green-500 cursor-pointer pointer-events-auto"
                        onClick={() => handleDeleteConnection(conn.id)}
                      />
                      <text
                        x={(fromX + toX) / 2}
                        y={(fromY + toY) / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-xs font-bold fill-green-600 cursor-pointer pointer-events-auto"
                        onClick={() => handleDeleteConnection(conn.id)}
                      >
                        ×
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3, 0 6"
                  fill="currentColor"
                  className="text-primary"
                />
              </marker>
            </defs>
          </svg>

          {/* Equipment Items */}
          {equipments.map((equipment: EquipmentPlacement) => {
            const imageUrl = equipment.equipment?.imageUrl
              ? `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${equipment.equipment.imageUrl}`
              : null;
            
            const isSelected = sourceEquipment?.id === equipment.id;
            const isHovered = hoveredEquipment === equipment.id;

            return (
              <Card
                key={equipment.id}
                className={`absolute cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? "shadow-2xl scale-110 ring-4 ring-green-500 border-green-500" 
                    : isHovered && connectionMode === "connecting" && sourceEquipment
                    ? "shadow-lg scale-105 ring-2 ring-blue-400"
                    : "hover:shadow-lg hover:scale-105"
                }`}
                style={{
                  left: equipment.positionX || 0,
                  top: equipment.positionY || 0,
                  width: 120,
                  height: 120,
                  zIndex: 10,
                }}
                onClick={() => handleEquipmentClick(equipment)}
                onMouseEnter={() => setHoveredEquipment(equipment.id || null)}
                onMouseLeave={() => setHoveredEquipment(null)}
              >
                <div className="h-full flex flex-col items-center justify-center p-2 gap-2 relative">
                  {isSelected && (
                    <Badge className="absolute top-1 right-1 bg-green-500 text-xs px-1 py-0">
                      Source
                    </Badge>
                  )}
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={equipment.equipment?.equipmentName || "Equipment"}
                      className="w-16 h-16 object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-2xl">
                      🔬
                    </div>
                  )}
                  <p className="text-xs font-medium text-center line-clamp-2">
                    {equipment.equipment?.equipmentName || "Equipment"}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Equipment Interaction Dialog */}
      {selectedEquipment && (
        <EquipmentInteractionDialog
          equipment={selectedEquipment}
          open={!!selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
          currentStep={currentStep}
        />
      )}
    </div>
  );
}
