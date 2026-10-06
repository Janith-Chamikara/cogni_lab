"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import Image from "next/image";
import { ImageIcon, Settings, Trash2 } from "lucide-react";
import { LabEquipment, TerminalSpec } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { getTerminals, terminalTone } from "@/lib/circuit-terminals";
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
  /** Opens the config dialog. Omitted where config can't be edited. */
  onConfig?: (index: number) => void;
  /**
   * Student canvas only: every handle can start or end a wire, so terminals
   * can be joined left-to-left (parallel). Instructor editor leaves it unset.
   */
  looseTerminals?: boolean;
};

const SIDE_POSITION: Record<TerminalSpec["side"], Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

/** One labelled handle per named terminal, spread evenly along each side. */
function TerminalHandles({ terminals }: { terminals: TerminalSpec[] }) {
  return (
    <>
      {terminals.map((terminal) => {
        const sameSide = terminals.filter((t) => t.side === terminal.side);
        const offset = `${((sameSide.indexOf(terminal) + 1) / (sameSide.length + 1)) * 100}%`;
        const vertical = terminal.side === "left" || terminal.side === "right";
        return (
          <div key={terminal.id}>
            <Handle
              type="source"
              id={terminal.id}
              position={SIDE_POSITION[terminal.side]}
              style={vertical ? { top: offset } : { left: offset }}
              title={terminal.name}
              className={`!h-3 !w-3 !rounded-full !border-2 !bg-background ${terminalTone(terminal)}`}
            />
            <span
              className="pointer-events-none absolute z-10 text-[10px] font-semibold leading-none text-muted-foreground"
              style={{
                ...(vertical
                  ? { top: offset, transform: "translateY(-50%)" }
                  : { left: offset, transform: "translateX(-50%)" }),
                ...(terminal.side === "left" && { left: 8 }),
                ...(terminal.side === "right" && { right: 8 }),
                ...(terminal.side === "top" && { top: 6 }),
                ...(terminal.side === "bottom" && { bottom: 6 }),
              }}
            >
              {terminal.label}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function EquipmentNode({ data }: { data: EquipmentNodeData }) {
  const imageUrl = getCloudinaryUrl(data.equipment.imageUrl);
  const [showActions, setShowActions] = useState(false);
  const inputType = data.looseTerminals ? "source" : "target";
  const terminals = getTerminals(data.equipment);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Connection handles: named terminals, or 4 positional handles for
          equipment without terminal data */}
      {terminals ? (
        <TerminalHandles terminals={terminals} />
      ) : (
        <>
          <Handle
            type={inputType}
            position={Position.Left}
            id="left"
            className="!h-3 !w-3 !rounded-full !border-2 !border-blue-500 !bg-background"
          />
          <Handle
            type={inputType}
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
        </>
      )}

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
        // "nodrag": clicks here must not start a React Flow node drag.
        <div className="nodrag absolute -top-2 right-0 z-20 flex gap-1">
          {data.equipment.supportsConfiguration && data.onConfig && (
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6"
              title="Configure"
              onClick={(e) => {
                e.stopPropagation();
                data.onConfig?.(data.index);
              }}
            >
              <Settings className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="destructive"
            className="h-6 w-6"
            title="Remove"
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
