"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, ImageIcon } from "lucide-react";
import type { EquipmentPlacement } from "@/lib/types";
import { Input } from "@/components/ui/input";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId?: string | null) => {
  if (!publicId || !cloudinaryCloudName) {
    return null;
  }
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${publicId}`;
};

// Primary values shown next to a component (matches the instructor's config).
const VALUE_FIELDS: { key: string; unit: string }[] = [
  { key: "resistance", unit: "Ω" },
  { key: "capacitance", unit: "µF" },
  { key: "inductance", unit: "H" },
  { key: "voltage", unit: "V" },
];

/** Short value text for a placement, e.g. "100 Ω". */
export const getPlacementValueText = (placement: EquipmentPlacement) => {
  const config = {
    ...((placement.equipment?.defaultConfigJson as Record<string, unknown>) ??
      {}),
    ...(placement.configJson ?? {}),
  };
  for (const field of VALUE_FIELDS) {
    const value = config[field.key];
    if (typeof value === "number" || typeof value === "string") {
      return `${value} ${field.unit}`;
    }
  }
  return null;
};

/** Display name for a required component, e.g. "R1 · 100 Ω". */
export const getPlacementDisplayName = (placement: EquipmentPlacement) => {
  const label =
    placement.componentLabel ?? placement.equipment?.equipmentName ?? "";
  const value = getPlacementValueText(placement);
  return value ? `${label} · ${value}` : label;
};

type StudentEquipmentSidebarProps = {
  /** The lab's required components (instructor placements). */
  placements: EquipmentPlacement[];
};

function DraggableSidebarItem({
  placement,
}: {
  placement: EquipmentPlacement;
}) {
  const equipment = placement.equipment!;
  const imageUrl = getCloudinaryUrl(equipment.imageUrl);

  const handleDragStart = (e: React.DragEvent) => {
    // The placement id tells the editor which required component this is.
    e.dataTransfer.setData("application/equipment", placement.id!);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex cursor-grab flex-col items-center rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary hover:shadow-md active:cursor-grabbing"
    >
      {imageUrl ? (
        <div className="relative h-12 w-12">
          <Image
            src={imageUrl}
            alt={equipment.equipmentName}
            fill
            className="object-contain"
          />
        </div>
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <p className="mt-2 w-full truncate text-center text-xs font-medium">
        {placement.componentLabel ?? equipment.equipmentName}
      </p>
      <p className="w-full truncate text-center text-[10px] text-muted-foreground">
        {getPlacementValueText(placement) ?? equipment.equipmentName}
      </p>
    </div>
  );
}

export function StudentEquipmentSidebar({
  placements,
}: StudentEquipmentSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const validPlacements = placements.filter(
    (p) => p.id !== undefined && p.equipment,
  );

  const query = searchQuery.toLowerCase();
  const filteredPlacements = validPlacements.filter(
    (p) =>
      p.equipment!.equipmentName.toLowerCase().includes(query) ||
      p.equipment!.equipmentType.toLowerCase().includes(query) ||
      (p.componentLabel ?? "").toLowerCase().includes(query),
  );

  return (
    <aside className="flex w-64 flex-col border-l bg-background flex-shrink-0">
      <div className="border-b p-4">
        <h2 className="mb-3 font-semibold">Equipment & Materials</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search equipment"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Components
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {filteredPlacements.map((placement) => (
            <DraggableSidebarItem key={placement.id} placement={placement} />
          ))}
        </div>

        {filteredPlacements.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No equipment found
          </p>
        )}
      </div>
    </aside>
  );
}
