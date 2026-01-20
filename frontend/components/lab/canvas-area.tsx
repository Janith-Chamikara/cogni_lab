"use client";

import { forwardRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import Image from "next/image";
import { Settings, Trash2, ImageIcon } from "lucide-react";
import { EquipmentPlacement, LabEquipment } from "@/lib/types";
import { Button } from "@/components/ui/button";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId?: string | null) => {
  if (!publicId || !cloudinaryCloudName) {
    return null;
  }
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${publicId}`;
};

type PlacedEquipment = EquipmentPlacement & {
  equipment: LabEquipment;
};

type CanvasAreaProps = {
  placedEquipments: PlacedEquipment[];
  onEquipmentMove: (index: number, x: number, y: number) => void;
  onEquipmentRemove: (index: number) => void;
  onEquipmentConfig: (index: number) => void;
};

export const CanvasArea = forwardRef<HTMLDivElement, CanvasAreaProps>(
  function CanvasArea(
    { placedEquipments, onEquipmentMove, onEquipmentRemove, onEquipmentConfig },
    forwardedRef,
  ) {
    const { setNodeRef, isOver } = useDroppable({
      id: "canvas",
    });

    // Combine refs
    const setRefs = (node: HTMLDivElement | null) => {
      setNodeRef(node);
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    return (
      <div
        ref={setRefs}
        className={`relative flex-1 overflow-auto bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:20px_20px] ${
          isOver ? "ring-2 ring-inset ring-primary/50" : ""
        }`}
      >
        {placedEquipments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Drop equipment here</p>
              <p className="text-sm">
                Drag components from the sidebar to build your circuit
              </p>
            </div>
          </div>
        )}

        {placedEquipments.map((placement, index) => (
          <PlacedEquipmentItem
            key={`${placement.equipmentId}-${index}`}
            placement={placement}
            index={index}
            onMove={onEquipmentMove}
            onRemove={onEquipmentRemove}
            onConfig={onEquipmentConfig}
          />
        ))}
      </div>
    );
  },
);

type PlacedEquipmentItemProps = {
  placement: PlacedEquipment;
  index: number;
  onMove: (index: number, x: number, y: number) => void;
  onRemove: (index: number) => void;
  onConfig: (index: number) => void;
};

function PlacedEquipmentItem({
  placement,
  index,
  onMove,
  onRemove,
  onConfig,
}: PlacedEquipmentItemProps) {
  const imageUrl = getCloudinaryUrl(placement.equipment.imageUrl);

  const handleDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX - placement.positionX;
    const startY = e.clientY - placement.positionY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newX = Math.round((moveEvent.clientX - startX) / 10) * 10;
      const newY = Math.round((moveEvent.clientY - startY) / 10) * 10;
      onMove(index, Math.max(0, newX), Math.max(0, newY));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="group absolute cursor-move rounded-lg border-2 border-transparent bg-card p-2 shadow-md transition-all hover:border-primary hover:shadow-lg"
      style={{
        left: placement.positionX,
        top: placement.positionY,
        zIndex: placement.positionZ,
      }}
      onMouseDown={handleDrag}
    >
      <div className="relative h-20 w-20">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={placement.equipment.equipmentName}
            fill
            className="pointer-events-none object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Hover Controls */}
      <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {placement.equipment.supportsConfiguration && (
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onConfig(index);
            }}
          >
            <Settings className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="destructive"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="mt-1 text-center text-xs font-medium">
        {placement.equipment.equipmentName}
      </div>
    </div>
  );
}
