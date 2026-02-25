"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, ImageIcon } from "lucide-react";
import type { LabEquipment } from "@/lib/types";
import { Input } from "@/components/ui/input";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId?: string | null) => {
  if (!publicId || !cloudinaryCloudName) {
    return null;
  }
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${publicId}`;
};

type StudentEquipmentSidebarProps = {
  equipments: (LabEquipment | null | undefined)[];
};

function DraggableSidebarItem({ equipment }: { equipment: LabEquipment }) {
  const imageUrl = getCloudinaryUrl(equipment.imageUrl);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/equipment", equipment.id);
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
        {equipment.equipmentName}
      </p>
    </div>
  );
}

export function StudentEquipmentSidebar({
  equipments,
}: StudentEquipmentSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const validEquipments = equipments.filter(
    (eq): eq is LabEquipment => eq !== null && eq !== undefined,
  );

  const filteredEquipments = validEquipments.filter(
    (eq) =>
      eq.equipmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.equipmentType.toLowerCase().includes(searchQuery.toLowerCase()),
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
          {filteredEquipments.map((equipment) => (
            <DraggableSidebarItem key={equipment.id} equipment={equipment} />
          ))}
        </div>

        {filteredEquipments.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No equipment found
          </p>
        )}
      </div>
    </aside>
  );
}
