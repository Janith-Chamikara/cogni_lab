"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Cable,
  CheckCircle2,
  AlertCircle,
  TestTube2,
  XCircle,
  Info,
  Send,
  AlertTriangle,
  Sparkles,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  History,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  Lab,
  ExperimentStep,
  LabAttempt,
  StudentAction,
  StudentCircuitPayload,
  ValidationResult,
  WireConnection,
} from "@/lib/types";
import {
  getMyLabAttempts,
  getProgressFeedback,
  submitLabAttempt,
  validateLabCircuit,
} from "@/lib/actions";
import { AiMessageContent } from "@/components/ai-message-content";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StudentCircuitCanvas } from "@/components/student/student-circuit-canvas";
import {
  StudentEquipmentSidebar,
  getPlacementDisplayName,
} from "@/components/student/student-equipment-sidebar";
import { WIRE_COLORS } from "@/components/lab/circuit-canvas/constants";
import { CircuitDebugToggle } from "@/components/lab/circuit-debug/circuit-debug-toggle";
import { usePersistentFlag } from "@/hooks/use-persistent-flag";
import { editorRootClass, useFocusMode } from "@/hooks/use-focus-mode";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildLabContext } from "@/lib/ai-context";
import { useAiPageContext } from "@/hooks/use-ai-page-context";

const wireKey = (conn: WireConnection) =>
  `${conn.sourceEquipmentId}.${conn.sourceHandle}|${conn.targetEquipmentId}.${conn.targetHandle}`;

const wireEnds = (conn: WireConnection) => ({
  from: `${conn.sourceEquipmentId}.${conn.sourceHandle}`,
  to: `${conn.targetEquipmentId}.${conn.targetHandle}`,
});

type LabPlacement = NonNullable<Lab["labEquipments"]>[number];

/** A canvas part for one of the lab's placements (R1, V1, ...). */
const toCanvasPart = (
  placement: LabPlacement,
  id: string,
  x: number,
  y: number,
  z: number,
) => ({
  id,
  equipmentId: placement.equipmentId,
  labEquipmentId: placement.id,
  positionX: x,
  positionY: y,
  positionZ: z,
  configJson: placement.configJson ?? null,
  // Display only: the canvas node shows the component label/value.
  equipment: {
    ...placement.equipment!,
    equipmentName: getPlacementDisplayName(placement),
  },
});

/**
 * Rebuild the canvas from a stored submission. Parts whose placement no
 * longer exists (the instructor edited the lab) are dropped with their wires.
 */
const circuitFromSubmission = (stored: unknown, placements: LabPlacement[]) => {
  const circuit = (stored ?? {}) as {
    components?: unknown[];
    connections?: unknown[];
  };
  const components = (
    Array.isArray(circuit.components) ? circuit.components : []
  ).flatMap((raw, index) => {
    const part = raw as {
      id?: unknown;
      equipmentId?: unknown;
      labEquipmentId?: unknown;
      positionX?: unknown;
      positionY?: unknown;
    };
    const placement = placements.find((p) =>
      part.labEquipmentId
        ? p.id === part.labEquipmentId
        : p.equipmentId === part.equipmentId,
    );
    if (typeof part.id !== "string" || !placement?.equipment) return [];
    return [
      toCanvasPart(
        placement,
        part.id,
        Number(part.positionX) || 0,
        Number(part.positionY) || 0,
        index,
      ),
    ];
  });
  const ids = new Set(components.map((part) => part.id));
  const connections = (
    Array.isArray(circuit.connections) ? circuit.connections : []
  ).flatMap((raw, index) => {
    const wire = raw as WireConnection;
    return ids.has(wire.sourceEquipmentId) && ids.has(wire.targetEquipmentId)
      ? [
          {
            id: `restored-${index}`,
            sourceEquipmentId: wire.sourceEquipmentId,
            targetEquipmentId: wire.targetEquipmentId,
            sourceHandle: wire.sourceHandle ?? null,
            targetHandle: wire.targetHandle ?? null,
            wireColor: wire.wireColor ?? undefined,
          },
        ]
      : [];
  });
  return { components, connections };
};

interface StudentLabEditorProps {
  lab: Lab;
}

export function StudentLabEditor({ lab }: StudentLabEditorProps) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [placedEquipments, setPlacedEquipments] = React.useState<any[]>([]);
  const [wireConnections, setWireConnections] = React.useState<any[]>([]);
  const [isWireMode, setIsWireMode] = React.useState(false);
  const [selectedWireColor, setSelectedWireColor] = React.useState<string>(
    WIRE_COLORS[0]?.value ?? "#374151",
  );
  const [validationResult, setValidationResult] =
    React.useState<ValidationResult | null>(null);
  const [resultSource, setResultSource] = React.useState<"check" | "submit">(
    "check",
  );
  const [showValidation, setShowValidation] = React.useState(false);
  const [objectiveExpanded, setObjectiveExpanded] = React.useState(false);
  const [aiFeedback, setAiFeedback] = React.useState<
    | { status: "idle" | "loading" }
    | { status: "done"; text: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  // Only the latest check's AI feedback is shown.
  const feedbackRequestRef = React.useRef(0);
  const [showInstructions, setShowInstructions] = usePersistentFlag(
    "cognilab.lab.showInstructions",
    true,
  );
  const [showEquipment, setShowEquipment] = usePersistentFlag(
    "cognilab.lab.showEquipment",
    true,
  );
  const { isFocusMode, toggleFocusMode } = useFocusMode();

  const [isChecking, setIsChecking] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [bestAttempt, setBestAttempt] = React.useState<LabAttempt | null>(null);
  // Analytics only: grading always uses the final circuit state.
  const actionLogRef = React.useRef<StudentAction[]>([]);
  // Set once the student edits the canvas, so a late-loading submission
  // never overwrites their work.
  const userTouchedRef = React.useRef(false);
  // When the canvas shows the last submission: its submission time.
  const [restoredFrom, setRestoredFrom] = React.useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false);

  const logAction = React.useCallback(
    (action: Omit<StudentAction, "timestamp">) => {
      userTouchedRef.current = true;
      setRestoredFrom(null);
      actionLogRef.current.push({
        ...action,
        timestamp: new Date().toISOString(),
      });
    },
    [],
  );

  // Show the last submitted circuit again, unless the student has already
  // started working on the canvas.
  React.useEffect(() => {
    getMyLabAttempts(lab.id).then((result) => {
      if (!result.data) return;
      setBestAttempt(result.data.bestAttempt);
      const latest = result.data.latestSubmission;
      if (!latest || userTouchedRef.current) return;
      const restored = circuitFromSubmission(
        latest.circuit,
        lab.labEquipments || [],
      );
      if (restored.components.length === 0) return;
      setPlacedEquipments(restored.components);
      setWireConnections(restored.connections);
      setRestoredFrom(latest.submittedAt);
    });
  }, [lab.id, lab.labEquipments]);

  const steps = lab.experimentSteps || [];
  const totalSteps = steps.length;
  const expectedEquipments = React.useMemo(
    () => lab.labEquipments || [],
    [lab.labEquipments],
  );
  // How many copies of each lab part are on the canvas (sidebar badges).
  const placedCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const eq of placedEquipments) {
      if (eq.labEquipmentId) {
        counts.set(eq.labEquipmentId, (counts.get(eq.labEquipmentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [placedEquipments]);

  useAiPageContext({
    pageType: "student-lab",
    lab: buildLabContext(lab),
    student: {
      currentStepIndex,
      totalSteps,
    },
    workspace: {
      components: placedEquipments,
      connections: wireConnections,
      completedStepIds: [],
    },
  });

  // The sidebar drags a lab placement id, so each student component knows
  // which required component (R1, R2, ...) it is.
  const handleEquipmentDrop = React.useCallback(
    (placementId: string, x: number, y: number) => {
      const placement = expectedEquipments.find((le) => le.id === placementId);
      if (placement?.equipment) {
        const newPlacement = toCanvasPart(
          placement,
          `student-${Date.now()}`,
          x,
          y,
          placedEquipments.length,
        );
        setPlacedEquipments((prev) => [...prev, newPlacement]);
        logAction({ action: "ADD", componentId: newPlacement.id });
      }
    },
    [expectedEquipments, placedEquipments.length, logAction],
  );

  const handleEquipmentMove = React.useCallback(
    (index: number, x: number, y: number) => {
      setPlacedEquipments((prev) =>
        prev.map((eq, i) =>
          i === index ? { ...eq, positionX: x, positionY: y } : eq,
        ),
      );
    },
    [],
  );

  const handleEquipmentRemove = React.useCallback(
    (index: number) => {
      const removedEquipment = placedEquipments[index];
      if (!removedEquipment) return;
      logAction({ action: "REMOVE", componentId: removedEquipment.id });
      setPlacedEquipments((prev) => prev.filter((_, i) => i !== index));
      setWireConnections((prev) =>
        prev.filter(
          (conn) =>
            conn.sourceEquipmentId !== removedEquipment.id &&
            conn.targetEquipmentId !== removedEquipment.id,
        ),
      );
    },
    [placedEquipments, logAction],
  );

  const handleConnectionsChange = React.useCallback(
    (connections: any[]) => {
      const before = new Set(wireConnections.map(wireKey));
      const after = new Set(connections.map(wireKey));
      for (const conn of connections) {
        if (!before.has(wireKey(conn))) {
          logAction({ action: "CONNECT", ...wireEnds(conn) });
        }
      }
      for (const conn of wireConnections) {
        if (!after.has(wireKey(conn))) {
          logAction({ action: "DISCONNECT", ...wireEnds(conn) });
        }
      }
      setWireConnections(connections);
    },
    [wireConnections, logAction],
  );

  const handleExitLab = () => {
    router.push("/student/dashboard");
  };

  const buildPayload = (): StudentCircuitPayload => ({
    components: placedEquipments.map((eq) => ({
      id: eq.id,
      equipmentId: eq.equipmentId,
      labEquipmentId: eq.labEquipmentId,
      positionX: eq.positionX,
      positionY: eq.positionY,
    })),
    connections: wireConnections.map((conn) => ({
      sourceEquipmentId: conn.sourceEquipmentId,
      targetEquipmentId: conn.targetEquipmentId,
      sourceHandle: conn.sourceHandle,
      targetHandle: conn.targetHandle,
      wireColor: conn.wireColor,
    })),
    // Steps are instructions only and are not graded.
    completedStepIds: [],
  });

  const handleCheckProgress = async () => {
    setIsChecking(true);
    setRequestError(null);
    const payload = buildPayload();

    // The AI explanation is slower; start it now and show it when it lands.
    const requestId = ++feedbackRequestRef.current;
    setAiFeedback({ status: "loading" });
    getProgressFeedback(lab.id, payload, currentStepIndex).then((feedback) => {
      if (requestId !== feedbackRequestRef.current) return;
      setAiFeedback(
        feedback.data
          ? { status: "done", text: feedback.data.reply }
          : {
              status: "error",
              message: feedback.error ?? "AI feedback is unavailable.",
            },
      );
    });

    const result = await validateLabCircuit(lab.id, payload);
    setIsChecking(false);

    if (result.error || !result.data) {
      feedbackRequestRef.current++;
      setAiFeedback({ status: "idle" });
      setRequestError(result.error ?? "Failed to check your circuit.");
      return;
    }
    setValidationResult(result.data);
    setResultSource("check");
    setShowValidation(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setRequestError(null);
    const result = await submitLabAttempt(lab.id, {
      ...buildPayload(),
      actionLog: actionLogRef.current,
    });
    setIsSubmitting(false);

    if (result.error || !result.data) {
      setRequestError(result.error ?? "Failed to submit your lab.");
      return;
    }
    setValidationResult(result.data.result);
    setBestAttempt(result.data.bestAttempt);
    setResultSource("submit");
    setShowValidation(true);
    // The canvas now is the latest submission; the next attempt's action
    // log starts empty.
    setRestoredFrom(result.data.attempt.submittedAt);
    actionLogRef.current = [];
  };

  // Start over with an empty canvas (after confirmation). Submitted
  // attempts are kept.
  const handleReset = () => {
    userTouchedRef.current = true;
    setPlacedEquipments([]);
    setWireConnections([]);
    setRestoredFrom(null);
    setShowValidation(false);
    actionLogRef.current = [];
  };

  const resultChecks = validationResult
    ? Object.values(validationResult.checks)
    : [];
  // Detailed issues that are not already shown as a check message.
  const resultIssues = validationResult
    ? validationResult.errors.filter(
        (msg) => !resultChecks.some((check) => check.message === msg),
      )
    : [];

  return (
    <div className={editorRootClass(isFocusMode)}>
      {/* Validation Results Dialog */}
      {showValidation && validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {resultSource === "submit" ? (
                    <Send className="h-5 w-5" />
                  ) : (
                    <TestTube2 className="h-5 w-5" />
                  )}
                  {resultSource === "submit"
                    ? "Submission Results"
                    : "Progress Check Results"}
                </CardTitle>
                <Badge
                  variant={validationResult.passed ? "default" : "secondary"}
                  className={`gap-1 ${validationResult.passed ? "bg-green-600" : ""}`}
                >
                  {validationResult.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {validationResult.passed ? "Validated" : "Not validated yet"}
                </Badge>
              </div>
              <CardDescription>
                {resultSource === "submit"
                  ? "Your circuit has been submitted and graded."
                  : "Review your circuit before submitting. This check is not saved."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* AI explanation of this check (Check Progress only) */}
              {resultSource === "check" && aiFeedback.status !== "idle" && (
                <section
                  className="rounded-lg border border-primary/30 bg-primary/5 p-4"
                  aria-live="polite"
                  aria-busy={aiFeedback.status === "loading"}
                >
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI feedback
                  </h3>
                  {aiFeedback.status === "loading" && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Reviewing your circuit…
                      </p>
                      <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    </div>
                  )}
                  {aiFeedback.status === "done" && (
                    <AiMessageContent content={aiFeedback.text} />
                  )}
                  {aiFeedback.status === "error" && (
                    <p className="text-sm text-muted-foreground">
                      {aiFeedback.message} The checks below are still accurate.
                    </p>
                  )}
                  {aiFeedback.status !== "error" && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Written by AI from the checks below; it can make mistakes.
                    </p>
                  )}
                </section>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {validationResult.warnings.map((msg, idx) => (
                      <li key={idx}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Final verdict */}
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  {validationResult.passed ? (
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Excellent! Lab setup is complete and correct.
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Keep going! Review the feedback and make adjustments.
                    </p>
                  )}
                  {resultSource === "submit" && bestAttempt && (
                    <p className="text-xs text-muted-foreground">
                      {bestAttempt.passed
                        ? "You have a validated submission for this lab."
                        : "No validated submission yet. You can submit again."}
                    </p>
                  )}
                </div>
                <Button onClick={() => setShowValidation(false)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 border-b bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExitLab}
              className="shrink-0"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
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
                {lab.module?.moduleName || "General Lab"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {requestError && (
              <span className="max-w-56 truncate text-xs text-red-600 dark:text-red-400">
                {requestError}
              </span>
            )}
            {bestAttempt?.passed && (
              <Badge
                variant="outline"
                className="gap-1 border-green-500/50 text-green-700 dark:text-green-400"
                title="You have submitted a validated circuit for this lab"
              >
                <CheckCircle2 className="h-3 w-3" />
                Validated
              </Badge>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCheckProgress()}
              disabled={isChecking || isSubmitting}
            >
              <TestTube2 className="mr-2 h-4 w-4" />
              {isChecking ? "Checking..." : "Check Progress"}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isChecking || isSubmitting}
            >
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
            <CircuitDebugToggle labId={lab.id} payload={buildPayload()} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Sidebar - Objective & Steps (collapsible) */}
        {showInstructions && (
          <aside className="flex w-72 shrink-0 flex-col border-r bg-background xl:w-80">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-semibold">Instructions</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowInstructions(false)}
                title="Hide instructions"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {/* Objective */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Objective
                </h3>
                <p
                  className={`text-sm leading-relaxed ${
                    objectiveExpanded ? "" : "line-clamp-4"
                  }`}
                >
                  {lab.description || "No objective provided."}
                </p>
                {(lab.description?.length ?? 0) > 180 && (
                  <button
                    type="button"
                    className="mt-1 text-xs font-medium text-primary hover:underline"
                    onClick={() => setObjectiveExpanded((value) => !value)}
                  >
                    {objectiveExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </section>

              {/* Steps */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Steps
                  </h3>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {totalSteps}
                  </span>
                </div>

                {steps.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      No steps defined
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ol className="space-y-1">
                    {steps.map((step: ExperimentStep, index: number) => {
                      const isCurrent = index === currentStepIndex;
                      return (
                        <li key={step.id}>
                          <button
                            type="button"
                            className={`flex w-full items-start gap-3 rounded-md border p-2.5 text-left transition-colors ${
                              isCurrent
                                ? "border-primary/60 bg-primary/5"
                                : "border-transparent hover:bg-muted"
                            }`}
                            onClick={() => setCurrentStepIndex(index)}
                            aria-current={isCurrent ? "step" : undefined}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                                isCurrent
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 text-sm leading-snug">
                              {step.stepDescription}
                              {step.procedure && isCurrent && (
                                <span className="mt-1 block whitespace-pre-line text-xs text-muted-foreground">
                                  {step.procedure}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {/* Progress Summary */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Lab Summary
                </h3>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    {
                      label: "Parts",
                      value: `${placedEquipments.length}/${expectedEquipments.length}`,
                    },
                    { label: "Wires", value: wireConnections.length },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-md border p-2">
                      <p className="text-sm font-semibold tabular-nums">
                        {stat.value}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Follow the steps, use Check Progress for feedback, then Submit
                  when your circuit is ready.
                </p>
              </section>
            </div>
          </aside>
        )}

        {/* Main Canvas Area */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Canvas toolbar */}
          <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5">
            {!showInstructions && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowInstructions(true)}
                title="Show instructions"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isWireMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsWireMode(!isWireMode)}
                    className="gap-2"
                  >
                    <Cable className="h-4 w-4" />
                    Wire Mode
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isWireMode
                    ? "Click to disable wire mode and move components"
                    : "Click to enable wire mode and connect components"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isWireMode && (
              <div className="flex items-center gap-1 border-l pl-3">
                {WIRE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`h-5 w-5 rounded-full border-2 transition-all ${
                      selectedWireColor === color.value
                        ? "border-foreground ring-2 ring-ring"
                        : "border-transparent hover:border-muted-foreground"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setSelectedWireColor(color.value)}
                    title={`Wire colour: ${color.name}`}
                  />
                ))}
              </div>
            )}

            <p className="ml-2 hidden min-w-0 flex-1 truncate text-xs text-muted-foreground lg:block">
              {isWireMode
                ? "Drag from any terminal to another terminal to connect. Click a wire to remove it."
                : "Drag components from the equipment panel onto the canvas."}
            </p>

            <div className="ml-auto flex items-center gap-1">
              {restoredFrom && (
                <span
                  className="mr-1 hidden items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground md:flex"
                  title="This is the circuit you last submitted. Edit it to try again, or Reset to start over."
                >
                  <History className="h-3.5 w-3.5" />
                  Your last submission ·{" "}
                  {new Date(restoredFrom).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsResetConfirmOpen(true)}
                disabled={
                  placedEquipments.length === 0 && wireConnections.length === 0
                }
                title="Clear the canvas and start again"
              >
                <RotateCcw className="h-4 w-4 lg:mr-2" />
                <span className="hidden lg:inline">Reset</span>
              </Button>
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
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <StudentCircuitCanvas
              placedEquipments={placedEquipments}
              wireConnections={wireConnections}
              onEquipmentMove={handleEquipmentMove}
              onEquipmentRemove={handleEquipmentRemove}
              onConnectionsChange={handleConnectionsChange}
              onEquipmentDrop={handleEquipmentDrop}
              isWireMode={isWireMode}
              selectedWireColor={selectedWireColor}
            />
          </div>
        </main>

        {/* Right Sidebar - Equipment (collapsible) */}
        {showEquipment && (
          <StudentEquipmentSidebar
            placements={expectedEquipments}
            placedCounts={placedCounts}
            onCollapse={() => setShowEquipment(false)}
          />
        )}
      </div>

      {/* Help Dialog */}
      <ConfirmDialog
        open={isResetConfirmOpen}
        onOpenChange={setIsResetConfirmOpen}
        title="Start this lab again?"
        description="This clears every part and wire from the canvas. Your submitted attempts and your validated result are kept."
        confirmLabel="Clear canvas"
        destructive
        icon={RotateCcw}
        onConfirm={handleReset}
      />
    </div>
  );
}
