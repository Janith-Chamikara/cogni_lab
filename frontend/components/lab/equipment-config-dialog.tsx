"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ConfigField, LabEquipment } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageIcon } from "lucide-react";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const getCloudinaryUrl = (publicId?: string | null) => {
  if (!publicId || !cloudinaryCloudName) {
    return null;
  }
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${publicId}`;
};

type EquipmentConfigDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: LabEquipment;
  currentConfig: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
};

type SettingField = ConfigField | { key: "name"; label: string; type: "text" };

/** Every part can be renamed; its other settings come from its definition. */
const NAME_FIELD: SettingField = { key: "name", label: "Name", type: "text" };

export function EquipmentConfigDialog({
  open,
  onOpenChange,
  equipment,
  currentConfig,
  onSave,
}: EquipmentConfigDialogProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(currentConfig);
  const imageUrl = getCloudinaryUrl(equipment.imageUrl);

  useEffect(() => {
    setConfig(currentConfig);
  }, [currentConfig]);

  const schema: SettingField[] = [
    NAME_FIELD,
    ...(equipment.component?.fields ?? []),
  ];

  const handleChange = (key: string, value: string | number | undefined) => {
    setConfig((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const handleSave = () => {
    onSave(config);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{equipment.equipmentName}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center py-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={equipment.equipmentName}
                fill
                className="object-contain p-2"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {schema.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <Label className="w-24 shrink-0 text-right">{field.label}</Label>
              {field.type === "select" ? (
                <Select
                  value={(config[field.key] as string) || ""}
                  onValueChange={(value) => handleChange(field.key, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={`Select ${field.label.toLowerCase()}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {("options" in field ? field.options : [])?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    type={field.type}
                    min={"min" in field ? field.min : undefined}
                    max={"max" in field ? field.max : undefined}
                    step="any"
                    value={(config[field.key] as string | number) ?? ""}
                    onChange={(e) =>
                      handleChange(
                        field.key,
                        field.type !== "number"
                          ? e.target.value
                          : e.target.value === "" ||
                              Number.isNaN(e.target.valueAsNumber)
                            ? undefined
                            : e.target.valueAsNumber,
                      )
                    }
                    placeholder={
                      "default" in field && field.default !== undefined
                        ? `Default: ${field.default}`
                        : `Enter ${field.label.toLowerCase()}`
                    }
                  />
                  {"unit" in field && field.unit && (
                    <span className="text-sm text-muted-foreground">
                      {field.unit}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
