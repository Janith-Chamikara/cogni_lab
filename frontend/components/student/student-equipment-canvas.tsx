"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import type { Lab, ExperimentStep, EquipmentPlacement, WireConnection } from "@/lib/types";
import { EquipmentInteractionDialog } from "./equipment-interaction-dialog";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

interface StudentEquipmentCanvasProps {
  lab: Lab;
  currentStep: ExperimentStep | undefined;
  onStepComplete: () => void;
}

export function StudentEquipmentCanvas({
  lab,
  currentStep,
}: StudentEquipmentCanvasProps) {
  const [selectedEquipment, setSelectedEquipment] = React.useState<any>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);

  const equipments = lab.labEquipments || [];
  const connections = lab.wireConnections || [];

  const handleEquipmentClick = (equipment: any) => {
    setSelectedEquipment(equipment);
  };

  return (
    <div className="relative w-full h-full bg-grid-pattern" ref={canvasRef}>
      <div className="absolute inset-0 overflow-auto p-8">
        {/* Circuit Canvas Background */}
        <div className="relative min-h-full">
          {/* Draw Connections */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {connections.map((conn: WireConnection) => {
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

              return (
                <line
                  key={conn.id}
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                  markerEnd="url(#arrowhead)"
                />
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

            return (
              <Card
                key={equipment.id}
                className="absolute cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                style={{
                  left: equipment.positionX || 0,
                  top: equipment.positionY || 0,
                  width: 120,
                  height: 120,
                  zIndex: 10,
                }}
                onClick={() => handleEquipmentClick(equipment)}
              >
                <div className="h-full flex flex-col items-center justify-center p-2 gap-2">
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
