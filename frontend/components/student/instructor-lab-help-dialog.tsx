"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Lightbulb,
  Wrench,
  ClipboardList,
  Zap,
  AlertCircle,
} from "lucide-react";
import type { Lab, ExperimentStep, EquipmentPlacement } from "@/lib/types";

interface InstructorLabHelpDialogProps {
  lab: Lab;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstructorLabHelpDialog({
  lab,
  isOpen,
  onOpenChange,
}: InstructorLabHelpDialogProps) {
  const requiredEquipment = lab.labEquipments || [];
  const wireConnections = lab.wireConnections || [];
  const steps = lab.experimentSteps || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Instructor Lab Design - Reference Guide
          </DialogTitle>
          <DialogDescription>
            Use this guide to understand the lab layout and design from your instructor.
            This reference can help you complete the experiment successfully.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="steps">Steps Guide</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Overview Tab */}
              <TabsContent value="overview" className="m-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{lab.labName}</CardTitle>
                    <CardDescription>{lab.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {lab.instructor && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Designed by:
                        </p>
                        <p className="text-sm">
                          {lab.instructor.fullName || "Unknown Instructor"}
                        </p>
                      </div>
                    )}

                    {lab.module && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Module:
                        </p>
                        <p className="text-sm">{lab.module.moduleName}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <p className="text-xs text-muted-foreground font-medium">
                          Equipment Items
                        </p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {requiredEquipment.length}
                        </p>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                        <p className="text-xs text-muted-foreground font-medium">
                          Wire Connections
                        </p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {wireConnections.length}
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-xs text-muted-foreground font-medium">
                          Experiment Steps
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {steps.length}
                        </p>
                      </div>
                    </div>

                    <Alert>
                      <Lightbulb className="h-4 w-4" />
                      <AlertDescription>
                        This reference guide shows the complete lab design as set up by
                        your instructor. Use it to understand the expected layout and
                        configuration.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Equipment Tab */}
              <TabsContent value="equipment" className="m-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Equipment Setup
                    </CardTitle>
                    <CardDescription>
                      All equipment items that need to be configured for this lab
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {requiredEquipment.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No equipment required for this lab
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-3">
                        {requiredEquipment.map((equip, index) => (
                          <div
                            key={equip.id || index}
                            className="p-4 border rounded-lg space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  <Badge variant="outline">#{index + 1}</Badge>
                                  {equip.equipment?.equipmentName ||
                                    "Unknown Equipment"}
                                </h4>
                                {equip.equipment?.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {equip.equipment.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 bg-muted rounded">
                                <p className="text-muted-foreground font-medium">
                                  Position X:
                                </p>
                                <p className="font-mono">
                                  {equip.positionX ?? "N/A"}
                                </p>
                              </div>
                              <div className="p-2 bg-muted rounded">
                                <p className="text-muted-foreground font-medium">
                                  Position Y:
                                </p>
                                <p className="font-mono">
                                  {equip.positionY ?? "N/A"}
                                </p>
                              </div>
                            </div>

                            {equip.configJson && (
                              <div className="p-2 bg-muted rounded text-xs">
                                <p className="text-muted-foreground font-medium mb-1">
                                  Default Configuration:
                                </p>
                                <pre className="text-xs overflow-x-auto">
                                  {typeof equip.configJson === "string"
                                    ? equip.configJson
                                    : JSON.stringify(equip.configJson, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Connections Tab */}
              <TabsContent value="connections" className="m-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Wire Connections
                    </CardTitle>
                    <CardDescription>
                      How equipment is connected together in the lab
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {wireConnections.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No wire connections defined for this lab
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-3">
                        {wireConnections.map((connection, index) => {
                          const sourceEquip = requiredEquipment.find(
                            (e) => e.equipmentId === connection.sourceEquipmentId
                          );
                          const targetEquip = requiredEquipment.find(
                            (e) => e.equipmentId === connection.targetEquipmentId
                          );

                          return (
                            <div
                              key={connection.id || index}
                              className="p-4 border rounded-lg space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    Connection #{index + 1}
                                  </p>
                                </div>
                                {connection.wireColor && (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded border"
                                      style={{
                                        backgroundColor: connection.wireColor,
                                      }}
                                    />
                                    <span className="text-xs font-mono">
                                      {connection.wireColor}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-2 bg-muted rounded">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    Source
                                  </p>
                                  <p className="font-medium">
                                    {sourceEquip?.equipment?.equipmentName ||
                                      "Unknown"}
                                  </p>
                                  {connection.sourceHandle && (
                                    <p className="text-xs text-muted-foreground">
                                      Handle: {connection.sourceHandle}
                                    </p>
                                  )}
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    Target
                                  </p>
                                  <p className="font-medium">
                                    {targetEquip?.equipment?.equipmentName ||
                                      "Unknown"}
                                  </p>
                                  {connection.targetHandle && (
                                    <p className="text-xs text-muted-foreground">
                                      Handle: {connection.targetHandle}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Steps Guide Tab */}
              <TabsContent value="steps" className="m-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Experiment Steps
                    </CardTitle>
                    <CardDescription>
                      Complete step-by-step guide for the experiment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {steps.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No experiment steps defined for this lab
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-3">
                        {steps.map((step: ExperimentStep, index: number) => (
                          <div
                            key={step.id || index}
                            className="p-4 border rounded-lg space-y-3"
                          >
                            <div className="flex items-start gap-3">
                              <Badge className="mt-0.5">Step {index + 1}</Badge>
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm">
                                  {step.stepDescription}
                                </h4>
                              </div>
                            </div>

                            {step.procedure && (
                              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                                  Detailed Procedure:
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {step.procedure}
                                </p>
                              </div>
                            )}

                            {step.minTolerance !== null &&
                              step.maxTolerance !== null && (
                              <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                                <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">
                                  Success Criteria:
                                </p>
                                <p className="text-sm font-mono">
                                  {step.minTolerance} to {step.maxTolerance}{" "}
                                  {step.unit ? `(${step.unit})` : ""}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
