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

interface StudentLabEditorProps {
  lab: Lab;
}

export function StudentLabEditor({ lab }: StudentLabEditorProps) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(
    new Set()
  );
  const [placedEquipments, setPlacedEquipments] = React.useState<any[]>([]);
  const [wireConnections, setWireConnections] = React.useState<any[]>([]);
  const [isWireMode, setIsWireMode] = React.useState(false);

  const steps = lab.experimentSteps || [];
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps.size / totalSteps) * 100 : 0;
  const allEquipments = lab.labEquipments?.map(le => le.equipment).filter(Boolean) || [];

  const handleEquipmentDrop = React.useCallback((equipmentId: string, x: number, y: number) => {
    const equipment = allEquipments.find(eq => eq?.id === equipmentId);
    if (equipment) {
      const newPlacement = {
        id: `student-${Date.now()}`,
        equipmentId: equipment.id,
        positionX: x,
        positionY: y,
        positionZ: placedEquipments.length,
        equipment,
      };
      setPlacedEquipments(prev => [...prev, newPlacement]);
    }
  }, [allEquipments, placedEquipments.length]);

  const handleEquipmentMove = React.useCallback((index: number, x: number, y: number) => {
    setPlacedEquipments(prev =>
      prev.map((eq, i) => (i === index ? { ...eq, positionX: x, positionY: y } : eq))
    );
  }, []);

  const handleEquipmentRemove = React.useCallback((index: number) => {
    const removedEquipment = placedEquipments[index];
    setPlacedEquipments(prev => prev.filter((_, i) => i !== index));
    setWireConnections(prev =>
      prev.filter(
        conn =>
          conn.sourceEquipmentId !== removedEquipment.id &&
          conn.targetEquipmentId !== removedEquipment.id
      )
    );
  }, [placedEquipments]);

  const handleConnectionsChange = React.useCallback((connections: any[]) => {
    setWireConnections(connections);
  }, []);

  const handleCompleteStep = () => {
    setCompletedSteps(prev => new Set([...prev, currentStepIndex]));
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

  return (
    <div className="flex h-screen flex-col">
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
                variant={isWireMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsWireMode(!isWireMode)}
              >
                <Cable className="h-4 w-4 mr-2" />
                {isWireMode ? "Wire Mode: ON" : "Wire Mode: OFF"}
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
                            <div className="mt-0.5">
                              {isCompleted ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Circle className="h-5 w-5" />
                              )}
                            </div>
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
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <StudentCircuitCanvas
              placedEquipments={placedEquipments}
              wireConnections={wireConnections}
              onEquipmentMove={handleEquipmentMove}
              onEquipmentRemove={handleEquipmentRemove}
              onConnectionsChange={handleConnectionsChange}
              onEquipmentDrop={handleEquipmentDrop}
              isWireMode={isWireMode}
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
                        <Badge variant="outline" className="bg-green-100 dark:bg-green-900/20">
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
                    <Button size="sm" onClick={handleCompleteStep}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {completedSteps.has(currentStepIndex) ? "Completed" : "Complete"}
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
