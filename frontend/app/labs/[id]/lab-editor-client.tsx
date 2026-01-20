"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Save,
  Trash2,
  Settings,
} from "lucide-react";
import {
  Lab,
  LabEquipment,
  EquipmentPlacement,
  ExperimentStep,
  WireConnection,
} from "@/lib/types";
import { updateLabEquipments, updateLabSteps, updateLabConnections } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { EquipmentSidebar } from "@/components/lab/equipment-sidebar";
import { CircuitCanvas, PlacedEquipment } from "@/components/lab/circuit-canvas";
import { StepsSidebar } from "@/components/lab/steps-sidebar";
import { ThresholdsDialog } from "@/components/lab/thresholds-dialog";
import { EquipmentConfigDialog } from "@/components/lab/equipment-config-dialog";

type LabEditorClientProps = {
  lab: Lab;
  availableEquipments: LabEquipment[];
};

export function LabEditorClient({
  lab,
  availableEquipments,
}: LabEditorClientProps) {
  // Initialize placed equipments from lab data
  const [placedEquipments, setPlacedEquipments] = useState<PlacedEquipment[]>(
    () =>
      (lab.labEquipments || []).map((eq) => ({
        ...eq,
        equipment: eq.equipment!,
      })),
  );

  // Initialize wire connections from lab data
  const [wireConnections, setWireConnections] = useState<WireConnection[]>(
    lab.wireConnections || [],
  );

  // Initialize steps from lab data
  const [steps, setSteps] = useState<ExperimentStep[]>(
    lab.experimentSteps || [],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);
  const [configEquipment, setConfigEquipment] =
    useState<PlacedEquipment | null>(null);

  // Handle equipment drop from sidebar
  const handleEquipmentDrop = useCallback(
    (equipmentId: string, x: number, y: number) => {
      const equipment = availableEquipments.find((eq) => eq.id === equipmentId);
      if (equipment) {
        const newPlacement: PlacedEquipment = {
          id: `temp-${Date.now()}`,
          equipmentId: equipment.id,
          positionX: x,
          positionY: y,
          positionZ: placedEquipments.length,
          configJson:
            (equipment.defaultConfigJson as Record<string, unknown>) || null,
          equipment,
        };
        setPlacedEquipments((prev) => [...prev, newPlacement]);
      }
    },
    [availableEquipments, placedEquipments.length],
  );

  const handleEquipmentMove = useCallback(
    (index: number, x: number, y: number) => {
      setPlacedEquipments((prev) =>
        prev.map((eq, i) =>
          i === index ? { ...eq, positionX: x, positionY: y } : eq,
        ),
      );
    },
    [],
  );

  const handleEquipmentRemove = useCallback((index: number) => {
    const removedEquipment = placedEquipments[index];
    // Remove equipment
    setPlacedEquipments((prev) => prev.filter((_, i) => i !== index));
    // Also remove any wire connections involving this equipment
    if (removedEquipment.id) {
      setWireConnections((prev) =>
        prev.filter(
          (conn) =>
            conn.sourceEquipmentId !== removedEquipment.id &&
            conn.targetEquipmentId !== removedEquipment.id,
        ),
      );
    }
  }, [placedEquipments]);

  const handleConnectionsChange = useCallback(
    (connections: WireConnection[]) => {
      setWireConnections(connections);
    },
    [],
  );

  const handleEquipmentConfig = useCallback(
    (index: number) => {
      setConfigEquipment(placedEquipments[index]);
    },
    [placedEquipments],
  );

  const handleConfigSave = useCallback(
    (config: Record<string, unknown>) => {
      if (!configEquipment) return;

      setPlacedEquipments((prev) =>
        prev.map((eq) =>
          eq.equipmentId === configEquipment.equipmentId &&
          eq.positionX === configEquipment.positionX &&
          eq.positionY === configEquipment.positionY
            ? { ...eq, configJson: config }
            : eq,
        ),
      );
      setConfigEquipment(null);
    },
    [configEquipment],
  );

  const handleSave = async () => {
    setIsSaving(true);

    // Save equipments first to get IDs
    const equipmentResult = await updateLabEquipments(
      lab.id,
      placedEquipments.map((eq) => ({
        equipmentId: eq.equipmentId,
        positionX: eq.positionX,
        positionY: eq.positionY,
        positionZ: eq.positionZ,
        configJson: eq.configJson || undefined,
      })),
    );

    // Update placed equipments with real IDs from server
    if (equipmentResult.data?.labEquipments) {
      const newEquipments = equipmentResult.data.labEquipments.map((eq) => ({
        ...eq,
        equipment: eq.equipment!,
      }));
      setPlacedEquipments(newEquipments);

      // Map old temp IDs to new real IDs for connections
      const idMap = new Map<string, string>();
      placedEquipments.forEach((oldEq, index) => {
        if (newEquipments[index]) {
          idMap.set(oldEq.id || `temp-${index}`, newEquipments[index].id!);
        }
      });

      // Update wire connections with real IDs
      const updatedConnections = wireConnections.map((conn) => ({
        ...conn,
        sourceEquipmentId:
          idMap.get(conn.sourceEquipmentId) || conn.sourceEquipmentId,
        targetEquipmentId:
          idMap.get(conn.targetEquipmentId) || conn.targetEquipmentId,
      }));

      // Save connections
      await updateLabConnections(lab.id, updatedConnections);
    }

    // Save steps
    await updateLabSteps(
      lab.id,
      steps.map((step) => ({
        stepNumber: step.stepNumber,
        stepDescription: step.stepDescription,
        procedure: step.procedure || undefined,
        minTolerance: step.minTolerance || undefined,
        maxTolerance: step.maxTolerance || undefined,
        unit: step.unit || undefined,
      })),
    );

    setIsSaving(false);
  };

  const handleAddStep = () => {
    const newStep: ExperimentStep = {
      stepNumber: steps.length + 1,
      stepDescription: "New step",
      procedure: "",
    };
    setSteps([...steps, newStep]);
  };

  const handleUpdateStep = (
    index: number,
    updates: Partial<ExperimentStep>,
  ) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step)),
    );
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, stepNumber: i + 1 })),
    );
  };

  return (
    <div className="mx-auto flex h-screen max-w-7xl flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">{lab.labName}</h1>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsThresholdsOpen(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Set Thresholds
          </Button>
          <Button variant="outline" size="sm">
            <Play className="mr-2 h-4 w-4" />
            Run
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Discard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Steps */}
        <StepsSidebar
          objective={lab.description || ""}
          steps={steps}
          onAddStep={handleAddStep}
          onUpdateStep={handleUpdateStep}
          onRemoveStep={handleRemoveStep}
        />

        {/* Canvas Area with React Flow */}
        <div className="relative flex-1">
          <CircuitCanvas
            placedEquipments={placedEquipments}
            wireConnections={wireConnections}
            onEquipmentMove={handleEquipmentMove}
            onEquipmentRemove={handleEquipmentRemove}
            onEquipmentConfig={handleEquipmentConfig}
            onConnectionsChange={handleConnectionsChange}
            onEquipmentDrop={handleEquipmentDrop}
          />
        </div>

        {/* Right Sidebar - Equipment */}
        <EquipmentSidebar equipments={availableEquipments} />
      </div>

      {/* Thresholds Dialog */}
      <ThresholdsDialog
        open={isThresholdsOpen}
        onOpenChange={setIsThresholdsOpen}
        lab={lab}
      />

      {/* Equipment Config Dialog */}
      {configEquipment && (
        <EquipmentConfigDialog
          open={!!configEquipment}
          onOpenChange={(open: boolean) => !open && setConfigEquipment(null)}
          equipment={configEquipment.equipment}
          currentConfig={configEquipment.configJson || {}}
          onSave={handleConfigSave}
        />
      )}
    </div>
  );
}
