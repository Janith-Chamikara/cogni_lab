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
import type { Lab, ExperimentStep, LabEquipment } from "@/lib/types";
import { StudentCircuitCanvas } from "@/components/student/student-circuit-canvas";
import { StudentEquipmentSidebar } from "@/components/student/student-equipment-sidebar";
import { WIRE_COLORS } from "@/components/lab/circuit-canvas/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [validationResults, setValidationResults] = React.useState<{
    isValid: boolean;
    score: number;
    feedback: string[];
    errors: string[];
  } | null>(null);
  const [showValidation, setShowValidation] = React.useState(false);

  const steps = lab.experimentSteps || [];
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progressPercentage =
    totalSteps > 0 ? (completedSteps.size / totalSteps) * 100 : 0;
  const allEquipments =
    lab.labEquipments?.map((le) => le.equipment).filter(Boolean) || [];
  const expectedEquipments = lab.labEquipments || [];
  const expectedConnections = lab.wireConnections || [];

  const handleEquipmentDrop = React.useCallback(
    (equipmentId: string, x: number, y: number) => {
      const equipment = allEquipments.find((eq) => eq?.id === equipmentId);
      if (equipment) {
        const newPlacement = {
          id: `student-${Date.now()}`,
          equipmentId: equipment.id,
          positionX: x,
          positionY: y,
          positionZ: placedEquipments.length,
          equipment,
        };
        setPlacedEquipments((prev) => [...prev, newPlacement]);
      }
    },
    [allEquipments, placedEquipments.length],
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
      setPlacedEquipments((prev) => prev.filter((_, i) => i !== index));
      setWireConnections((prev) =>
        prev.filter(
          (conn) =>
            conn.sourceEquipmentId !== removedEquipment.id &&
            conn.targetEquipmentId !== removedEquipment.id,
        ),
      );
    },
    [placedEquipments],
  );

  const handleConnectionsChange = React.useCallback((connections: any[]) => {
    setWireConnections(connections);
  }, []);

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
          setTimeout(() => handleCheckProgress(), 300);
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

  const handleCheckProgress = () => {
    const feedback: string[] = [];
    const errors: string[] = [];
    let score = 0;
    let totalChecks = 0;

    // Check if correct number of equipment is placed
    totalChecks++;
    if (placedEquipments.length >= expectedEquipments.length) {
      score++;
      feedback.push(
        `✓ You have placed ${placedEquipments.length} equipment items`,
      );
    } else {
      errors.push(
        `✗ Missing equipment: You have ${placedEquipments.length}/${expectedEquipments.length} items`,
      );
    }

    // Check if all required equipment types are present
    totalChecks++;
    const expectedTypes = expectedEquipments.map((e) => e.equipmentId);
    const placedTypes = placedEquipments.map((e) => e.equipmentId);
    const missingTypes = expectedTypes.filter(
      (type) => !placedTypes.includes(type),
    );

    if (missingTypes.length === 0) {
      score++;
      feedback.push("✓ All required equipment types are present");
    } else {
      const missingEquipment = expectedEquipments
        .filter((e) => missingTypes.includes(e.equipmentId))
        .map((e) => e.equipment?.equipmentName)
        .filter(Boolean);
      errors.push(`✗ Missing equipment: ${missingEquipment.join(", ")}`);
    }

    // Check connections
    totalChecks++;
    if (expectedConnections.length > 0) {
      if (wireConnections.length >= expectedConnections.length) {
        score++;
        feedback.push(`✓ You have ${wireConnections.length} connections`);
      } else {
        errors.push(
          `✗ Missing connections: You have ${wireConnections.length}/${expectedConnections.length} connections`,
        );
      }
    } else {
      if (wireConnections.length > 0) {
        score++;
        feedback.push(
          `✓ You have created ${wireConnections.length} connections`,
        );
      } else {
        feedback.push("ℹ No connections created yet");
      }
    }

    // Check step completion
    totalChecks++;
    if (completedSteps.size === totalSteps) {
      score++;
      feedback.push("✓ All steps completed");
    } else {
      errors.push(
        `✗ Complete all steps: ${completedSteps.size}/${totalSteps} done`,
      );
    }

    const finalScore = Math.round((score / totalChecks) * 100);
    const isValid = score === totalChecks;

    setValidationResults({
      isValid,
      score: finalScore,
      feedback,
      errors,
    });
    setShowValidation(true);
  };

  return (
    <div className="flex max-w-7xl mx-auto h-screen flex-col">
      {/* Validation Results Dialog */}
      {showValidation && validationResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TestTube2 className="h-5 w-5" />
                  Progress Check Results
                </CardTitle>
                <Badge
                  variant={validationResults.isValid ? "default" : "secondary"}
                  className={validationResults.isValid ? "bg-green-500" : ""}
                >
                  Score: {validationResults.score}%
                </Badge>
              </div>
              <CardDescription>
                Review your lab setup and progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Success feedback */}
              {validationResults.feedback.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Correct
                  </h3>
                  <div className="space-y-1">
                    {validationResults.feedback.map((msg, idx) => (
                      <Alert
                        key={idx}
                        className="bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                      >
                        <AlertDescription className="text-sm">
                          {msg}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {/* Error feedback */}
              {validationResults.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Needs Attention
                  </h3>
                  <div className="space-y-1">
                    {validationResults.errors.map((msg, idx) => (
                      <Alert key={idx} variant="destructive">
                        <AlertDescription className="text-sm">
                          {msg}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {/* Final verdict */}
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  {validationResults.isValid ? (
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      🎉 Excellent! Lab setup is complete and correct.
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Keep going! Review the feedback and make adjustments.
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
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCheckProgress}
              >
                <TestTube2 className="h-4 w-4 mr-2" />
                Check Progress
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
                ? "Drag from a green handle to a blue handle to connect"
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
        <StudentEquipmentSidebar equipments={allEquipments} />
      </div>
    </div>
  );
}
