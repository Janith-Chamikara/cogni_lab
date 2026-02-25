"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  FlaskConical,
  Play,
  AlertCircle,
  Wrench,
  XCircle,
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
import type { Lab, ExperimentStep } from "@/lib/types";
import { StudentEquipmentCanvas } from "@/components/student/student-equipment-canvas";

interface StudentLabClientProps {
  lab: Lab;
}

export function StudentLabClient({ lab }: StudentLabClientProps) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(
    new Set()
  );
  const [started, setStarted] = React.useState(false);
  const [setupComplete, setSetupComplete] = React.useState(false);
  const [setupEquipment, setSetupEquipment] = React.useState<Set<string>>(
    new Set()
  );

  const steps = lab.experimentSteps || [];
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps.size / totalSteps) * 100 : 0;
  
  const requiredEquipment = lab.labEquipments || [];
  const setupPercentage = requiredEquipment.length > 0 
    ? (setupEquipment.size / requiredEquipment.length) * 100 
    : 100;

  const handleStartExperiment = () => {
    setStarted(true);
  };

  const handleCompleteSetup = () => {
    setSetupComplete(true);
  };

  const handleToggleEquipmentSetup = (equipmentId: string) => {
    setSetupEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(equipmentId)) {
        next.delete(equipmentId);
      } else {
        next.add(equipmentId);
      }
      return next;
    });
  };

  const handleCompleteStep = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStepIndex]));
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
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

  const handleExitLab = () => {
    router.push("/student/dashboard");
  };

  if (!started) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{lab.labName}</CardTitle>
                <CardDescription className="mt-2">
                  {lab.description}
                </CardDescription>
              </div>
              <Badge>{lab.module?.moduleName || "General"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Experiment Overview</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">
                    {requiredEquipment.length || 0} Equipment Items
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">{steps.length} Steps</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Equipment Setup Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Equipment Setup
                </h3>
                <div className="flex items-center gap-2">
                  <Progress value={setupPercentage} className="w-24 h-2" />
                  <span className="text-sm text-muted-foreground">
                    {setupEquipment.size}/{requiredEquipment.length}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                {requiredEquipment.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No equipment required for this lab
                    </AlertDescription>
                  </Alert>
                ) : (
                  requiredEquipment.map((equipment) => {
                    const isSetup = setupEquipment.has(equipment.equipmentId);
                    return (
                      <button
                        key={equipment.equipmentId}
                        onClick={() => handleToggleEquipmentSetup(equipment.equipmentId)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50"
                      >
                        <div>
                          {isSetup ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">
                            {equipment.equipment?.equipmentName || "Unknown Equipment"}
                          </p>
                          {equipment.positionX !== null && equipment.positionY !== null && (
                            <p className="text-xs text-muted-foreground">
                              Position: ({equipment.positionX}, {equipment.positionY})
                            </p>
                          )}
                        </div>
                        <Badge variant={isSetup ? "default" : "outline"}>
                          {isSetup ? "Ready" : "Not Set"}
                        </Badge>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Experiment Steps</h3>
              <div className="space-y-2">
                {steps.map((step: ExperimentStep, index: number) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 text-sm p-2 rounded-md hover:bg-muted/50"
                  >
                    <Badge variant="outline" className="mt-0.5">
                      {index + 1}
                    </Badge>
                    <span>{step.stepDescription}</span>
                  </div>
                ))}
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please ensure all equipment is set before starting the experiment. 
                Click on equipment items above to mark them as ready.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button 
                onClick={handleStartExperiment} 
                className="flex-1"
                disabled={setupPercentage < 100}
              >
                <Play className="h-4 w-4 mr-2" />
                {setupPercentage < 100 
                  ? `Setup Equipment (${Math.round(setupPercentage)}%)`
                  : "Start Experiment"
                }
              </Button>
              <Button variant="outline" onClick={handleExitLab}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExitLab}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Exit Lab
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="font-semibold">{lab.labName}</h1>
                <p className="text-sm text-muted-foreground">
                  Step {currentStepIndex + 1} of {steps.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Setup Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Setup Complete
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              {/* Experiment Progress */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Progress:</span>
                <span className="text-sm font-medium">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="w-32" />
            </div>
          </div>
          
          {/* Equipment Setup Summary */}
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Wrench className="h-4 w-4" />
            <span>Equipment Ready: {setupEquipment.size}/{requiredEquipment.length}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Steps Completed: {completedSteps.size}/{totalSteps}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Steps */}
        <div className="w-80 border-r bg-muted/10 overflow-y-auto">
          <div className="p-4 space-y-2">
            <h2 className="font-semibold mb-4">Experiment Steps</h2>
            {steps.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  No steps defined for this experiment.
                </AlertDescription>
              </Alert>
            ) : (
              steps.map((step: ExperimentStep, index: number) => {
              const isCompleted = completedSteps.has(index);
              const isCurrent = index === currentStepIndex;

              return (
                <button
                  key={step.id}
                  onClick={() => handleGoToStep(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-green-100 dark:bg-green-900/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={isCurrent ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          Step {index + 1}
                        </Badge>
                      </div>
                      <p className="text-sm line-clamp-2">{step.stepDescription}</p>
                    </div>
                  </div>
                </button>
              );
            })
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Equipment Canvas */}
          <div className="flex-1 overflow-auto bg-muted/30">
            <StudentEquipmentCanvas
              lab={lab}
              currentStep={currentStep}
              onStepComplete={handleCompleteStep}
            />
          </div>

          {/* Bottom Panel - Current Step Instructions */}
          <div className="border-t bg-background">
            <div className="container mx-auto px-6 py-4">
              {currentStep ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>Step {currentStepIndex + 1}</Badge>
                        {completedSteps.has(currentStepIndex) && (
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/20">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold mb-2">Instructions</h3>
                      <p className="text-sm text-muted-foreground">
                        {currentStep.stepDescription}
                      </p>
                    </div>
                  </div>

                  {currentStep.minTolerance !== null &&
                    currentStep.maxTolerance !== null && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-medium">Success Criteria:</span>
                        <p className="mt-2 text-sm">
                          • Tolerance Range: {currentStep.minTolerance} to{" "}
                          {currentStep.maxTolerance} {currentStep.unit || ""}
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={handlePreviousStep}
                      disabled={currentStepIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setCompletedSteps((prev) => {
                            const next = new Set(prev);
                            next.delete(currentStepIndex);
                            return next;
                          })
                        }
                        disabled={!completedSteps.has(currentStepIndex)}
                      >
                        Reset Step
                      </Button>
                      <Button onClick={handleCompleteStep}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {completedSteps.has(currentStepIndex)
                          ? "Step Completed"
                          : "Mark as Complete"}
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleNextStep}
                      disabled={currentStepIndex === steps.length - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No experiment steps defined for this lab.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
