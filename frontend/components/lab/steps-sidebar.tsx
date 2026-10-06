"use client";

import { useState } from "react";
import { PanelLeftClose, Plus, Trash2 } from "lucide-react";
import { ExperimentStep } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StepsSidebarProps = {
  objective: string;
  steps: ExperimentStep[];
  onAddStep: () => void;
  onUpdateStep: (index: number, updates: Partial<ExperimentStep>) => void;
  onRemoveStep: (index: number) => void;
  /** Shows a button that hides the sidebar. */
  onCollapse?: () => void;
};

export function StepsSidebar({
  objective,
  steps,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onCollapse,
}: StepsSidebarProps) {
  const [objectiveExpanded, setObjectiveExpanded] = useState(false);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-background xl:w-80">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold">Instructions</h2>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCollapse}
            title="Hide instructions"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
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
            } ${objective ? "" : "text-muted-foreground"}`}
          >
            {objective || "No objective defined"}
          </p>
          {objective.length > 180 && (
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
              {steps.length}
            </span>
          </div>

          <ol className="space-y-2">
            {steps.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No steps yet. Add the first one below.
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
          </ol>

          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full border-dashed"
            onClick={onAddStep}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add step
          </Button>
        </section>
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
    <li className="group flex items-start gap-2 rounded-md border bg-card p-2 transition-colors hover:border-primary/40">
      <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
        {step.stepNumber}
      </span>
      <div className="min-w-0 flex-1">
        <Input
          value={step.stepDescription}
          onChange={(e) => onUpdate(index, { stepDescription: e.target.value })}
          className="h-8 text-sm"
          placeholder="Step description"
          aria-label={`Step ${step.stepNumber} description`}
        />
        {step.procedure && (
          <p className="mt-1.5 whitespace-pre-line text-xs text-muted-foreground">
            {step.procedure}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="mt-0.5 h-7 w-7 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => onRemove(index)}
        title={`Delete step ${step.stepNumber}`}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </li>
  );
}
