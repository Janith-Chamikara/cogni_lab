"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Cable,
  Play,
  CheckCircle2,
  Circle,
  AlertCircle,
  Plus,
  Minus,
  TestTube2,
  XCircle,
  Info,
  Lightbulb,
  Send,
  AlertTriangle,
  Trophy,
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  submitLabAttempt,
  validateLabCircuit,
} from "@/lib/actions";
import { StudentCircuitCanvas } from "@/components/student/student-circuit-canvas";
import {
  StudentEquipmentSidebar,
  getPlacementDisplayName,
} from "@/components/student/student-equipment-sidebar";
import { WIRE_COLORS } from "@/components/lab/circuit-canvas/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InstructorLabHelpDialog } from "@/components/student/instructor-lab-help-dialog";
import { buildLabContext } from "@/lib/ai-context";
import { useAiPageContext } from "@/hooks/use-ai-page-context";

const wireKey = (conn: WireConnection) =>
  `${conn.sourceEquipmentId}.${conn.sourceHandle}|${conn.targetEquipmentId}.${conn.targetHandle}`;

const wireEnds = (conn: WireConnection) => ({
  from: `${conn.sourceEquipmentId}.${conn.sourceHandle}`,
  to: `${conn.targetEquipmentId}.${conn.targetHandle}`,
});

interface StudentLabEditorProps {
  lab: Lab;
}

export function StudentLabEditor({ lab }: StudentLabEditorProps) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(
    new Set(),
  );
  const [placedEquipments, setPlacedEquipments] = React.useState<any[]>([]);
  const [wireConnections, setWireConnections] = React.useState<any[]>([]);
  const [isWireMode, setIsWireMode] = React.useState(false);
  const [selectedWireColor, setSelectedWireColor] = React.useState<string>(
    WIRE_COLORS[0]?.value ?? "#374151",
  );
  const [showHelpDialog, setShowHelpDialog] = React.useState(false);
  const [validationResult, setValidationResult] =
    React.useState<ValidationResult | null>(null);
  const [resultSource, setResultSource] = React.useState<"check" | "submit">(
    "check",
  );
  const [showValidation, setShowValidation] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [bestAttempt, setBestAttempt] = React.useState<LabAttempt | null>(
    null,
  );
  // Analytics only: grading always uses the final circuit state.
  const actionLogRef = React.useRef<StudentAction[]>([]);

  const logAction = React.useCallback(
    (action: Omit<StudentAction, "timestamp">) => {
      actionLogRef.current.push({
        ...action,
        timestamp: new Date().toISOString(),
      });
    },
    [],
  );

  React.useEffect(() => {
    getMyLabAttempts(lab.id).then((result) => {
      if (result.data) setBestAttempt(result.data.bestAttempt);
    });
  }, [lab.id]);

  const steps = lab.experimentSteps || [];
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progressPercentage =
    totalSteps > 0 ? (completedSteps.size / totalSteps) * 100 : 0;
  const expectedEquipments = React.useMemo(
    () => lab.labEquipments || [],
    [lab.labEquipments],
  );

  useAiPageContext({
    pageType: "student-lab",
    lab: buildLabContext(lab),
    student: {
      currentStepIndex,
      totalSteps,
      completedStepIds: [...completedSteps]
        .map((index) => steps[index]?.id)
        .filter((id): id is string => Boolean(id)),
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
        const newPlacement = {
          id: `student-${Date.now()}`,
          equipmentId: placement.equipmentId,
          labEquipmentId: placement.id,
          positionX: x,
          positionY: y,
          positionZ: placedEquipments.length,
          configJson: placement.configJson ?? null,
          // Display only: the canvas node shows the component label/value.
          equipment: {
            ...placement.equipment,
            equipmentName: getPlacementDisplayName(placement),
          },
        };
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

  const handleCompleteStep = () => {
    // Toggle completion status
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(currentStepIndex)) {
        newSet.delete(currentStepIndex);
      } else {
        newSet.add(currentStepIndex);
        // If it's the last step and marking as complete, check progress
        if (currentStepIndex === steps.length - 1) {
          setTimeout(() => handleCheckProgress(newSet), 300);
        }
      }
      return newSet;
    });

    // Auto-advance to next step if marking current as complete and not on last step
    if (
      !completedSteps.has(currentStepIndex) &&
      currentStepIndex < steps.length - 1
    ) {
      setTimeout(() => setCurrentStepIndex(currentStepIndex + 1), 500);
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleGoToStep = (index: number) => {
    setCurrentStepIndex(index);
  };

  const handleToggleStepComplete = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleExitLab = () => {
    router.push("/student/dashboard");
  };

  const buildPayload = (
    stepsDone: Set<number> = completedSteps,
  ): StudentCircuitPayload => ({
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
    completedStepIds: [...stepsDone]
      .map((index) => steps[index]?.id)
      .filter((id): id is string => Boolean(id)),
  });

  const handleCheckProgress = async (stepsDone?: Set<number>) => {
    setIsChecking(true);
    setRequestError(null);
    const result = await validateLabCircuit(lab.id, buildPayload(stepsDone));
    setIsChecking(false);

    if (result.error || !result.data) {
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
    <div className="flex max-w-7xl mx-auto h-screen flex-col">
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
                  className={validationResult.passed ? "bg-green-500" : ""}
                >
                  Score: {validationResult.score}%
                </Badge>
              </div>
              <CardDescription>
                {resultSource === "submit"
                  ? "Your circuit has been submitted and graded."
                  : "Review your circuit before submitting. This check is not saved."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* One line per check: ✓ passed / ✗ failed */}
              <div className="space-y-1">
                {resultChecks.map((check) => (
                  <Alert
                    key={check.label}
                    variant={check.passed ? "default" : "destructive"}
                    className={
                      check.passed
                        ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                        : ""
                    }
                  >
                    <AlertDescription className="flex items-center gap-2 text-sm">
                      {check.passed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      {check.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>

              {/* Details for failed checks, e.g. "R3 is not connected" */}
              {resultIssues.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Needs Attention
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {resultIssues.map((msg, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400">
                          ✗
                        </span>
                        {msg}
                      </li>
                    ))}
                  </ul>
                </div>
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
                      🎉 Excellent! Lab setup is complete and correct.
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Keep going! Review the feedback and make adjustments.
                    </p>
                  )}
                  {resultSource === "submit" && bestAttempt && (
                    <p className="text-xs text-muted-foreground">
                      Your best attempt counts for the grade: {bestAttempt.score}
                      %
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
      <div className="border-b bg-background">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleExitLab}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="font-semibold text-lg">{lab.labName}</h1>
                <p className="text-xs text-muted-foreground">
                  {lab.module?.moduleName || "General Lab"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {requestError && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {requestError}
                </span>
              )}
              {bestAttempt && (
                <Badge variant="outline" className="gap-1">
                  <Trophy className="h-3 w-3" />
                  Best: {bestAttempt.score}%
                </Badge>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCheckProgress()}
                disabled={isChecking || isSubmitting}
              >
                <TestTube2 className="h-4 w-4 mr-2" />
                {isChecking ? "Checking..." : "Check Progress"}
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isChecking || isSubmitting}
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHelpDialog(true)}
                data-ai-action="help"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Get Help
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Progress:</span>
                <span className="text-sm font-medium">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="w-32" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Objective & Steps */}
        <div className="w-80 border-r bg-background overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-6">
            {/* Objective */}
            <div>
              <h2 className="font-semibold mb-2">Objective</h2>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    {lab.description}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Steps</h2>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {steps.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    No steps defined
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {steps.map((step: ExperimentStep, index: number) => {
                    const isCompleted = completedSteps.has(index);
                    const isCurrent = index === currentStepIndex;

                    return (
                      <Card
                        key={step.id}
                        className={`cursor-pointer transition-colors ${
                          isCurrent
                            ? "border-primary bg-primary/5"
                            : isCompleted
                              ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                              : ""
                        }`}
                        onClick={() => handleGoToStep(index)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={(e) =>
                                handleToggleStepComplete(index, e)
                              }
                              className="mt-0.5 hover:scale-110 transition-transform"
                              title={
                                isCompleted
                                  ? "Mark as incomplete"
                                  : "Mark as complete"
                              }
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium mb-1">
                                Step {index + 1}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {step.stepDescription}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Progress Summary */}
            <div className="mt-6">
              <h2 className="font-semibold mb-2">Lab Summary</h2>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Equipment Placed:
                    </span>
                    <Badge variant="secondary">
                      {placedEquipments.length}/{expectedEquipments.length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Connections:</span>
                    <Badge variant="secondary">{wireConnections.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Steps Done:</span>
                    <Badge variant="secondary">
                      {completedSteps.size}/{totalSteps}
                    </Badge>
                  </div>
                  <Separator />
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Click <strong>"Check Progress"</strong> to validate your
                      lab setup and get feedback
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Wire mode + color bar (matches instructor editor) */}
          <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
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
              <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-sm text-muted-foreground">Wire Color:</span>
                <div className="flex gap-1">
                  {WIRE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`h-6 w-6 rounded-full border-2 transition-all ${
                        selectedWireColor === color.value
                          ? "border-foreground ring-2 ring-ring"
                          : "border-transparent hover:border-muted-foreground"
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setSelectedWireColor(color.value)}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="ml-auto text-sm text-muted-foreground">
              {isWireMode
                ? "Drag from any terminal to another terminal to connect"
                : "Drag components from the right sidebar to build your circuit"}
            </div>
          </div>

          <div className="flex-1 relative">
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

          {/* Bottom Panel - Current Step */}
          {currentStep && (
            <div className="border-t bg-background">
              <div className="container mx-auto px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge>Step {currentStepIndex + 1}</Badge>
                      {completedSteps.has(currentStepIndex) && (
                        <Badge
                          variant="outline"
                          className="bg-green-100 dark:bg-green-900/20"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {currentStep.stepDescription}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousStep}
                      disabled={currentStepIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCompleteStep}
                      variant={
                        completedSteps.has(currentStepIndex)
                          ? "outline"
                          : "default"
                      }
                    >
                      {completedSteps.has(currentStepIndex) ? (
                        <>
                          <XCircle className="h-4 w-4 mr-1" />
                          Mark Incomplete
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Mark Complete
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextStep}
                      disabled={currentStepIndex === steps.length - 1}
                    >
                      Next
                      <ChevronLeft className="h-4 w-4 ml-1 rotate-180" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Equipment */}
        <StudentEquipmentSidebar placements={expectedEquipments} />
      </div>

      {/* Help Dialog */}
      <InstructorLabHelpDialog
        lab={lab}
        isOpen={showHelpDialog}
        onOpenChange={setShowHelpDialog}
      />
    </div>
  );
}
