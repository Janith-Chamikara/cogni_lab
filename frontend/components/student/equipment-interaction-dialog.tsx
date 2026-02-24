"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExperimentStep } from "@/lib/types";

const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

interface EquipmentInteractionDialogProps {
  equipment: any;
  open: boolean;
  onClose: () => void;
  currentStep: ExperimentStep | undefined;
}

export function EquipmentInteractionDialog({
  equipment,
  open,
  onClose,
  currentStep,
}: EquipmentInteractionDialogProps) {
  const [configuration, setConfiguration] = React.useState<Record<string, any>>(
    equipment.configuration || {}
  );
  const [measurements, setMeasurements] = React.useState<Record<string, number>>({
    voltage: 0,
    current: 0,
    resistance: 0,
    power: 0,
  });

  const imageUrl = equipment.labEquipment?.imageUrl
    ? `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${equipment.labEquipment.imageUrl}`
    : null;

  const defaultConfig = equipment.labEquipment?.defaultConfig || {};
  const equipmentType = equipment.labEquipment?.type || "GENERAL";

  const handleConfigChange = (key: string, value: any) => {
    setConfiguration((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleMeasure = () => {
    // Simulate measurements based on configuration
    const voltage = configuration.voltage || 0;
    const resistance = configuration.resistance || 1;
    const current = voltage / resistance;
    const power = voltage * current;

    setMeasurements({
      voltage,
      current: Number(current.toFixed(3)),
      resistance,
      power: Number(power.toFixed(3)),
    });
  };

  const renderEquipmentControls = () => {
    switch (equipmentType) {
      case "POWER_SUPPLY":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Voltage (V)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[configuration.voltage || 0]}
                  onValueChange={([value]) => handleConfigChange("voltage", value)}
                  max={defaultConfig.maxVoltage || 50}
                  step={0.1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={configuration.voltage || 0}
                  onChange={(e) =>
                    handleConfigChange("voltage", parseFloat(e.target.value) || 0)
                  }
                  className="w-20"
                  step={0.1}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Current Limit (A)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[configuration.currentLimit || 0]}
                  onValueChange={([value]) =>
                    handleConfigChange("currentLimit", value)
                  }
                  max={defaultConfig.maxCurrent || 10}
                  step={0.01}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={configuration.currentLimit || 0}
                  onChange={(e) =>
                    handleConfigChange("currentLimit", parseFloat(e.target.value) || 0)
                  }
                  className="w-20"
                  step={0.01}
                />
              </div>
            </div>
          </div>
        );

      case "MULTIMETER":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Measurement Mode</Label>
              <select
                value={configuration.mode || "voltage"}
                onChange={(e) => handleConfigChange("mode", e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="voltage">Voltage (V)</option>
                <option value="current">Current (A)</option>
                <option value="resistance">Resistance (Ω)</option>
                <option value="continuity">Continuity</option>
              </select>
            </div>
            <Button onClick={handleMeasure} className="w-full">
              Take Measurement
            </Button>
            {measurements.voltage > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-center">
                  {measurements[configuration.mode || "voltage"]}
                  {configuration.mode === "voltage"
                    ? " V"
                    : configuration.mode === "current"
                    ? " A"
                    : " Ω"}
                </p>
              </div>
            )}
          </div>
        );

      case "OSCILLOSCOPE":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Time Scale (s/div)</Label>
              <select
                value={configuration.timeScale || "1m"}
                onChange={(e) => handleConfigChange("timeScale", e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="1u">1 µs/div</option>
                <option value="10u">10 µs/div</option>
                <option value="100u">100 µs/div</option>
                <option value="1m">1 ms/div</option>
                <option value="10m">10 ms/div</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Voltage Scale (V/div)</Label>
              <select
                value={configuration.voltageScale || "1"}
                onChange={(e) => handleConfigChange("voltageScale", e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="0.1">100 mV/div</option>
                <option value="0.5">500 mV/div</option>
                <option value="1">1 V/div</option>
                <option value="5">5 V/div</option>
                <option value="10">10 V/div</option>
              </select>
            </div>
            <div className="h-40 bg-black rounded-md flex items-center justify-center text-green-400 font-mono">
              [Waveform Display]
            </div>
          </div>
        );

      case "RESISTOR":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resistance (Ω)</Label>
              <Input
                type="number"
                value={configuration.resistance || defaultConfig.resistance || 1000}
                onChange={(e) =>
                  handleConfigChange("resistance", parseFloat(e.target.value) || 0)
                }
                step={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Power Rating (W)</Label>
              <Input
                type="number"
                value={configuration.powerRating || defaultConfig.powerRating || 0.25}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configuration options for this equipment type are not yet available.
            </p>
            {Object.keys(defaultConfig).length > 0 && (
              <div className="space-y-2">
                <Label>Default Configuration:</Label>
                <pre className="p-3 bg-muted rounded-md text-xs overflow-auto">
                  {JSON.stringify(defaultConfig, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{equipment.labEquipment?.name || "Equipment"}</DialogTitle>
          <DialogDescription>
            {equipment.labEquipment?.description || "Interact with this equipment"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Equipment Image */}
          {imageUrl && (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt={equipment.labEquipment?.name || "Equipment"}
                className="max-w-xs max-h-48 object-contain"
              />
            </div>
          )}

          <Separator />

          <Tabs defaultValue="controls" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="info">Information</TabsTrigger>
            </TabsList>

            <TabsContent value="controls" className="space-y-4 mt-4">
              {renderEquipmentControls()}
            </TabsContent>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="text-sm">{equipmentType.replace(/_/g, " ")}</p>
                </div>
                {equipment.labEquipment?.specifications && (
                  <div>
                    <Label className="text-muted-foreground">Specifications</Label>
                    <p className="text-sm whitespace-pre-wrap">
                      {equipment.labEquipment.specifications}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Position</Label>
                  <p className="text-sm">
                    X: {equipment.positionX}, Y: {equipment.positionY}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Step Guidance */}
          {currentStep && (
            <>
              <Separator />
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Badge>Current Step</Badge>
                  <p className="text-sm font-medium">Step Instructions</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentStep.stepDescription}
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => {
              // Save configuration
              console.log("Configuration saved:", configuration);
              onClose();
            }}>
              Apply Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
