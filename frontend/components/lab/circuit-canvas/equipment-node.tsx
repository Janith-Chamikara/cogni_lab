"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import Image from "next/image";
import { ImageIcon, Settings, Trash2 } from "lucide-react";
import { LabEquipment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import EquipmentsHandleCountForm from "./equipment-handle-count-form";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId?: string | null) => {
  if (!publicId || !cloudinaryCloudName) {
    return null;
  }
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${publicId}`;
};

export type EquipmentNodeData = {
  equipment: LabEquipment;
  index: number;
  onRemove: (index: number) => void;
  onConfig: (index: number) => void;
};

export function EquipmentNode({ data }: { data: EquipmentNodeData }) {
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
