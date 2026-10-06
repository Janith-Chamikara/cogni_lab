"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  Maximize2,
  Minimize2,
  PanelLeftOpen,
  PanelRightOpen,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import {
  CircuitRules,
  ExperimentStep,
  Lab,
  LabEquipment,
  WireConnection,
} from "@/lib/types";
import {
  updateLabConnections,
  updateLabEquipments,
  updateLabSteps,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EquipmentSidebar } from "@/components/lab/equipment-sidebar";
import {
  CircuitCanvas,
  PlacedEquipment,
} from "@/components/lab/circuit-canvas";
import { StepsSidebar } from "@/components/lab/steps-sidebar";
import { ThresholdsDialog } from "@/components/lab/thresholds-dialog";
import { EquipmentConfigDialog } from "@/components/lab/equipment-config-dialog";
import { ValidationRulesDialog } from "@/components/lab/validation-rules-dialog";
import { ReferenceDebugToggle } from "@/components/lab/circuit-debug/circuit-debug-toggle";
import { buildLabContext } from "@/lib/ai-context";
import { useAiPageContext } from "@/hooks/use-ai-page-context";
import { usePersistentFlag } from "@/hooks/use-persistent-flag";
import { editorRootClass, useFocusMode } from "@/hooks/use-focus-mode";

type LabEditorClientProps = {
  lab: Lab;
  availableEquipments: LabEquipment[];
};

type EditorState = {
  placedEquipments: PlacedEquipment[];
  wireConnections: WireConnection[];
  steps: ExperimentStep[];
};

type SaveStatus =
  | { status: "idle" | "saving" | "saved" }
  | { status: "error"; message: string };

/** What gets saved; used to detect unsaved changes. Ids are left out. */
const snapshotOf = ({
  placedEquipments,
  wireConnections,
  steps,
}: EditorState) =>
  JSON.stringify({
    parts: placedEquipments.map((eq) => [
      eq.equipmentId,
      eq.positionX,
      eq.positionY,
      eq.configJson ?? null,
    ]),
    wires: wireConnections.map((conn) => [
      placedEquipments.findIndex((eq) => eq.id === conn.sourceEquipmentId),
      conn.sourceHandle ?? null,
      placedEquipments.findIndex((eq) => eq.id === conn.targetEquipmentId),
      conn.targetHandle ?? null,
      conn.wireColor ?? null,
    ]),
    steps: steps.map((step) => [
      step.stepDescription,
      step.procedure ?? null,
      step.minTolerance ?? null,
      step.maxTolerance ?? null,
      step.unit ?? null,
    ]),
  });

export function LabEditorClient({
  lab,
  availableEquipments,
}: LabEditorClientProps) {
  const [saved, setSaved] = useState<EditorState>(() => ({
    placedEquipments: (lab.labEquipments || []).map((eq) => ({
      ...eq,
      equipment: eq.equipment!,
    })),
    wireConnections: lab.wireConnections || [],
    steps: lab.experimentSteps || [],
  }));
  const [placedEquipments, setPlacedEquipments] = useState<PlacedEquipment[]>(
    saved.placedEquipments,
  );
  const [wireConnections, setWireConnections] = useState<WireConnection[]>(
    saved.wireConnections,
  );
  const [steps, setSteps] = useState<ExperimentStep[]>(saved.steps);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: "idle" });
  // Bumped after each save so the reference debug panel reloads.
  const [savedVersion, setSavedVersion] = useState(0);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [circuitRules, setCircuitRules] = useState<CircuitRules | null>(
    lab.circuitRulesJson ?? null,
  );
  const [configEquipment, setConfigEquipment] =
    useState<PlacedEquipment | null>(null);
  const [showInstructions, setShowInstructions] = usePersistentFlag(
    "cognilab.editor.showInstructions",
    true,
  );
  const [showEquipment, setShowEquipment] = usePersistentFlag(
    "cognilab.editor.showEquipment",
    true,
  );
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const [pendingConfirm, setPendingConfirm] = useState<
    "discard" | "leave" | null
  >(null);
  const router = useRouter();

  const current: EditorState = { placedEquipments, wireConnections, steps };
  const isDirty = snapshotOf(current) !== snapshotOf(saved);
  const isSaving = saveStatus.status === "saving";

  const labContext = useMemo(
    () =>
      buildLabContext(lab, {
        steps,
        equipments: placedEquipments,
        connections: wireConnections,
      }),
    [lab, steps, placedEquipments, wireConnections],
  );

  useAiPageContext({
    pageType: "lab-editor",
    lab: labContext,
    hints: [
      "You are editing a lab. Help with wiring, steps, equipment configs, and thresholds.",
      "If the user asks about saving, mention the Save and Discard buttons in the header.",
    ],
  });

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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

  const handleEquipmentRemove = useCallback(
    (index: number) => {
      const removedEquipment = placedEquipments[index];
      setPlacedEquipments((prev) => prev.filter((_, i) => i !== index));
      if (removedEquipment.id) {
        setWireConnections((prev) =>
          prev.filter(
            (conn) =>
              conn.sourceEquipmentId !== removedEquipment.id &&
              conn.targetEquipmentId !== removedEquipment.id,
          ),
        );
      }
    },
    [placedEquipments],
  );

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
    if (isSaving) return;
    setSaveStatus({ status: "saving" });

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
    if (!equipmentResult.data?.labEquipments) {
      setSaveStatus({
        status: "error",
        message: equipmentResult.error ?? "Could not save the equipment.",
      });
      return;
    }

    const newEquipments: PlacedEquipment[] =
      equipmentResult.data.labEquipments.map((eq) => ({
        ...eq,
        equipment: eq.equipment!,
      }));

    // Placements get new ids on save; point the wires at them.
    const idMap = new Map<string, string>();
    placedEquipments.forEach((oldEq, index) => {
      if (newEquipments[index]) {
        idMap.set(oldEq.id || `temp-${index}`, newEquipments[index].id!);
      }
    });
    const updatedConnections = wireConnections.map((conn) => ({
      ...conn,
      sourceEquipmentId:
        idMap.get(conn.sourceEquipmentId) || conn.sourceEquipmentId,
      targetEquipmentId:
        idMap.get(conn.targetEquipmentId) || conn.targetEquipmentId,
    }));

    const [connectionResult, stepResult] = await Promise.all([
      updateLabConnections(lab.id, updatedConnections),
      updateLabSteps(
        lab.id,
        steps.map((step) => ({
          stepNumber: step.stepNumber,
          stepDescription: step.stepDescription,
          procedure: step.procedure || undefined,
          minTolerance: step.minTolerance || undefined,
          maxTolerance: step.maxTolerance || undefined,
          unit: step.unit || undefined,
        })),
      ),
    ]);

    setPlacedEquipments(newEquipments);
    setWireConnections(updatedConnections);
    const failure = connectionResult.error ?? stepResult.error;
    if (failure) {
      setSaveStatus({ status: "error", message: failure });
      return;
    }
    setSaved({
      placedEquipments: newEquipments,
      wireConnections: updatedConnections,
      steps,
    });
    setSavedVersion((version) => version + 1);
    setSaveStatus({ status: "saved" });
    setTimeout(
      () =>
        setSaveStatus((status) =>
          status.status === "saved" ? { status: "idle" } : status,
        ),
      2500,
    );
  };

  // Ctrl/Cmd + S saves the lab.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>("[data-lab-save]")?.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleDiscard = () => {
    setPlacedEquipments(saved.placedEquipments);
    setWireConnections(saved.wireConnections);
    setSteps(saved.steps);
    setSaveStatus({ status: "idle" });
  };

  // Leaving with unsaved changes asks first (in-app dialog).
  const handleBack = (e: React.MouseEvent) => {
    if (!isDirty) return;
    e.preventDefault();
    setPendingConfirm("leave");
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
    <div className={editorRootClass(isFocusMode)}>
      {/* Header */}
      <header className="shrink-0 border-b bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href="/dashboard" onClick={handleBack}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="min-w-0">
              <h1
                className="truncate text-base font-semibold leading-tight"
                title={lab.labName}
              >
                {lab.labName}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {lab.module?.moduleName || "Lab editor"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className="hidden text-xs lg:inline"
              role="status"
              aria-live="polite"
            >
              {saveStatus.status === "error" ? (
                <span className="text-red-600 dark:text-red-400">
                  {saveStatus.message}
                </span>
              ) : saveStatus.status === "saved" ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved
                </span>
              ) : isDirty ? (
                <span className="text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              ) : null}
            </span>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsThresholdsOpen(true)}
              title="Set thresholds"
            >
              <SlidersHorizontal className="h-4 w-4 xl:mr-2" />
              <span className="hidden xl:inline">Thresholds</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRulesOpen(true)}
            >
              <ListChecks className="mr-2 h-4 w-4" />
              Validation Rules
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingConfirm("discard")}
              disabled={!isDirty || isSaving}
              title="Discard unsaved changes"
            >
              <RotateCcw className="h-4 w-4 xl:mr-2" />
              <span className="hidden xl:inline">Discard</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              data-lab-save
              title="Save (Ctrl+S)"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <ReferenceDebugToggle labId={lab.id} savedVersion={savedVersion} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showInstructions && (
          <StepsSidebar
            objective={lab.description || ""}
            steps={steps}
            onAddStep={handleAddStep}
            onUpdateStep={handleUpdateStep}
            onRemoveStep={handleRemoveStep}
            onCollapse={() => setShowInstructions(false)}
          />
        )}

        <main className="relative min-w-0 flex-1">
          <CircuitCanvas
            placedEquipments={placedEquipments}
            wireConnections={wireConnections}
            onEquipmentMove={handleEquipmentMove}
            onEquipmentRemove={handleEquipmentRemove}
            onEquipmentConfig={handleEquipmentConfig}
            onConnectionsChange={handleConnectionsChange}
            onEquipmentDrop={handleEquipmentDrop}
            toolbarStart={
              !showInstructions && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowInstructions(true)}
                  title="Show instructions"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )
            }
            toolbarEnd={
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleFocusMode}
                  title={isFocusMode ? "Exit full screen (Esc)" : "Full screen"}
                >
                  {isFocusMode ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                {!showEquipment && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowEquipment(true)}
                    title="Show equipment"
                  >
                    <PanelRightOpen className="h-4 w-4" />
                  </Button>
                )}
              </>
            }
          />
        </main>

        {showEquipment && (
          <EquipmentSidebar
            equipments={availableEquipments}
            onCollapse={() => setShowEquipment(false)}
          />
        )}
      </div>

      <ThresholdsDialog
        open={isThresholdsOpen}
        onOpenChange={setIsThresholdsOpen}
        lab={lab}
      />

      {isRulesOpen && (
        <ValidationRulesDialog
          open={isRulesOpen}
          onOpenChange={setIsRulesOpen}
          labId={lab.id}
          rules={circuitRules}
          onSaved={setCircuitRules}
        />
      )}

      {configEquipment && (
        <EquipmentConfigDialog
          open={!!configEquipment}
          onOpenChange={(open: boolean) => !open && setConfigEquipment(null)}
          equipment={configEquipment.equipment}
          currentConfig={configEquipment.configJson || {}}
          onSave={handleConfigSave}
        />
      )}
      <ConfirmDialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => !open && setPendingConfirm(null)}
        title={
          pendingConfirm === "leave"
            ? "Leave without saving?"
            : "Discard unsaved changes?"
        }
        description={
          pendingConfirm === "leave"
            ? "Your changes to the parts, wires and steps since the last save will be lost."
            : "The canvas and steps go back to the last saved version of this lab."
        }
        confirmLabel={pendingConfirm === "leave" ? "Leave" : "Discard"}
        cancelLabel={pendingConfirm === "leave" ? "Stay" : "Keep editing"}
        destructive
        icon={pendingConfirm === "leave" ? ArrowLeft : RotateCcw}
        onConfirm={() =>
          pendingConfirm === "leave"
            ? router.push("/dashboard")
            : handleDiscard()
        }
      />
    </div>
  );
}
