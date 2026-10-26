"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { LabEquipment } from "@/lib/types";
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

// Default config schemas for common equipment types
const EQUIPMENT_CONFIG_SCHEMAS: Record<
  string,
  Array<{
    key: string;
    label: string;
    type: "text" | "number" | "select";
    unit?: string;
    options?: string[];
  }>
> = {
  "Function Generator": [
    { key: "name", label: "Name", type: "text" },
    { key: "frequency", label: "Frequency", type: "number", unit: "Hz" },
    { key: "amplitude", label: "Amplitude", type: "number", unit: "V" },
    { key: "dcOffset", label: "DC Offset", type: "number", unit: "V" },
    {
      key: "waveform",
      label: "Waveform",
      type: "select",
      options: ["Sine", "Square", "Triangle", "Sawtooth"],
    },
  ],
  Oscilloscope: [
    { key: "name", label: "Name", type: "text" },
    { key: "timeDiv", label: "Time/Div", type: "number", unit: "ms" },
    { key: "voltDiv", label: "Volt/Div", type: "number", unit: "V" },
    { key: "channels", label: "Channels", type: "number" },
  ],
  Multimeter: [
    { key: "name", label: "Name", type: "text" },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      options: ["Voltage", "Current", "Resistance", "Continuity"],
    },
    { key: "range", label: "Range", type: "text" },
  ],
  Resistor: [
    { key: "name", label: "Name", type: "text" },
    { key: "resistance", label: "Resistance", type: "number", unit: "Ω" },
    { key: "power", label: "Power Rating", type: "number", unit: "W" },
  ],
  Capacitor: [
    { key: "name", label: "Name", type: "text" },
    { key: "capacitance", label: "Capacitance", type: "number", unit: "µF" },
    { key: "voltage", label: "Voltage Rating", type: "number", unit: "V" },
  ],
  LED: [
    { key: "name", label: "Name", type: "text" },
    {
      key: "color",
      label: "Color",
      type: "select",
      options: ["Red", "Green", "Blue", "Yellow", "White"],
    },
    {
      key: "forwardVoltage",
      label: "Forward Voltage",
      type: "number",
      unit: "V",
    },
  ],
  "Power Supply": [
    { key: "name", label: "Name", type: "text" },
    { key: "voltage", label: "Voltage", type: "number", unit: "V" },
    { key: "current", label: "Current", type: "number", unit: "A" },
  ],
};

// Default schema for unknown equipment types
const DEFAULT_SCHEMA = [
  { key: "name", label: "Name", type: "text" as const },
  { key: "value1", label: "Value 1", type: "text" as const },
  { key: "value2", label: "Value 2", type: "text" as const },
];

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

  const schema =
    EQUIPMENT_CONFIG_SCHEMAS[equipment.equipmentName] ||
    EQUIPMENT_CONFIG_SCHEMAS[equipment.equipmentType] ||
    DEFAULT_SCHEMA;

  const handleChange = (key: string, value: string | number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
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
                    {field.options?.map((option) => (
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
                    value={(config[field.key] as string | number) ?? ""}
                    onChange={(e) =>
                      handleChange(
                        field.key,
                        field.type === "number"
                          ? parseFloat(e.target.value) || 0
                          : e.target.value,
                      )
                    }
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                  {field.unit && (
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
