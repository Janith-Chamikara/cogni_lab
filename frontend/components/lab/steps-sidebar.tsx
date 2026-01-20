"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { ExperimentStep } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StepsSidebarProps = {
  objective: string;
  steps: ExperimentStep[];
  onAddStep: () => void;
  onUpdateStep: (index: number, updates: Partial<ExperimentStep>) => void;
  onRemoveStep: (index: number) => void;
};

export function StepsSidebar({
  objective,
  steps,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
}: StepsSidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r bg-background">
      {/* Objective */}
      <div className="border-b p-4">
        <h2 className="mb-2 font-semibold">Objective</h2>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          {objective || "No objective defined"}
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Steps</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onAddStep}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {steps.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No steps defined. Add your first step.
            </p>
          ) : (
            steps.map((step, index) => (
              <StepItem
                key={index}
                step={step}
                index={index}
                onUpdate={onUpdateStep}
                onRemove={onRemoveStep}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

type StepItemProps = {
  step: ExperimentStep;
  index: number;
  onUpdate: (index: number, updates: Partial<ExperimentStep>) => void;
  onRemove: (index: number) => void;
};

function StepItem({ step, index, onUpdate, onRemove }: StepItemProps) {
  return (
    <div className="group rounded-lg border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {step.stepNumber}. {step.stepDescription}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>

      <Input
        value={step.stepDescription}
        onChange={(e) => onUpdate(index, { stepDescription: e.target.value })}
        className="h-8 text-sm"
        placeholder="Step description"
      />

      {step.procedure && (
        <p className="mt-2 text-xs text-muted-foreground">{step.procedure}</p>
      )}
    </div>
  );
}
