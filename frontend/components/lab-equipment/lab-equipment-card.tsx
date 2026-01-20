"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon, Settings, User } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LabEquipment } from "@/lib/types";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId?: string | null) => {
  if (!publicId || !cloudinaryCloudName) {
    return null;
  }
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${publicId}`;
};

type LabEquipmentCardProps = {
  equipment: LabEquipment;
};

export function LabEquipmentCard({ equipment }: LabEquipmentCardProps) {
  const [isViewOpen, setIsViewOpen] = useState(false);

  const imageUrl = getCloudinaryUrl(equipment.imageUrl);
  const defaultConfig = equipment.defaultConfigJson;
  const configText =
    typeof defaultConfig === "string"
      ? defaultConfig
      : defaultConfig
        ? JSON.stringify(defaultConfig, null, 2)
        : null;

  return (
    <>
      <div
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        onClick={() => setIsViewOpen(true)}
      >
        <div className="relative aspect-4/3 w-full overflow-hidden ">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={equipment.equipmentName}
              fill
              className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/50">
              <ImageIcon className="h-12 w-12" />
              <span className="text-xs">No image</span>
            </div>
          )}

          {equipment.supportsConfiguration && (
            <Badge
              variant="secondary"
              className="absolute right-2 top-2 gap-1 text-[10px]"
            >
              <Settings className="h-3 w-3" />
              Configurable
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div>
            <h3 className="line-clamp-1 font-semibold text-foreground">
              {equipment.equipmentName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {equipment.equipmentType}
            </p>
          </div>

          {equipment.description && (
            <p className="line-clamp-2 flex-1 text-sm text-muted-foreground/80">
              {equipment.description}
            </p>
          )}

          <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">
              {equipment.creator?.fullName || "Unknown"}
            </span>
          </div>
        </div>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{equipment.equipmentName}</span>
              {equipment.supportsConfiguration && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Settings className="h-3 w-3" />
                  Configurable
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={equipment.equipmentName}
                  fill
                  className="object-contain p-4"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/50">
                  <ImageIcon className="h-16 w-16" />
                  <span className="text-sm">No image available</span>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Equipment Type
                </div>
                <div className="text-sm font-medium">
                  {equipment.equipmentType}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Created By
                </div>
                <div className="text-sm">
                  <div className="font-medium">
                    {equipment.creator?.fullName || "Unknown"}
                  </div>
                  {equipment.creator?.email && (
                    <div className="text-muted-foreground">
                      {equipment.creator.email}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {equipment.description && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {equipment.description}
                </p>
              </div>
            )}

            {configText && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Default Configuration
                </div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-4 font-mono text-xs text-muted-foreground">
                  {configText}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
