"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import Image from "next/image";
import { Trash2, Settings, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId?: string | null) => {
  if (!publicId || !cloudinaryCloudName) {
    return null;
  }
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${publicId}`;
};

type EquipmentNodeData = {
  equipment: any;
  index: number;
  onRemove: (index: number) => void;
  onConfig?: (index: number) => void;
  isWireMode: boolean;
};

export const StudentEquipmentNode = memo(({ data }: NodeProps) => {
  const { equipment, index, onRemove, onConfig, isWireMode } = data as EquipmentNodeData;
  const imageUrl = getCloudinaryUrl(equipment?.imageUrl);

  return (
    <div
      className="bg-background border-2 border-border rounded-lg shadow-lg transition-all hover:border-primary"
      style={{ width: 180, padding: 12 }}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`!bg-blue-500 !border-2 !border-white ${
          isWireMode ? "!w-4 !h-4" : "!w-3 !h-3"
        }`}
        style={{ left: -8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`!bg-green-500 !border-2 !border-white ${
          isWireMode ? "!w-4 !h-4" : "!w-3 !h-3"
        }`}
        style={{ right: -8 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`!bg-blue-500 !border-2 !border-white ${
          isWireMode ? "!w-4 !h-4" : "!w-3 !h-3"
        }`}
        style={{ top: -8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`!bg-green-500 !border-2 !border-white ${
          isWireMode ? "!w-4 !h-4" : "!w-3 !h-3"
        }`}
        style={{ bottom: -8 }}
      />

      {/* Equipment Content */}
      <div className="flex flex-col items-center gap-2">
        {imageUrl ? (
          <div className="relative h-20 w-20">
            <Image
              src={imageUrl}
              alt={equipment?.equipmentName || "Equipment"}
              fill
              className="object-contain"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded bg-muted">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        <p className="text-xs font-semibold text-center line-clamp-2 px-1">
          {equipment?.equipmentName || "Unknown Equipment"}
        </p>

        {!isWireMode && (
          <div className="flex gap-1 mt-1">
            {onConfig && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => onConfig(index)}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Configure</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
});

StudentEquipmentNode.displayName = "StudentEquipmentNode";
