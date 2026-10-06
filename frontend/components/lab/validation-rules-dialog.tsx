"use client";

import { useEffect, useState } from "react";
import { Bug } from "lucide-react";
import { getLabReference, updateLabRules } from "@/lib/actions";
import { AllowedTopology, CircuitRules, ReferenceAnalysis } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircuitDebugView } from "@/components/lab/circuit-debug/circuit-debug-view";

const DEFAULT_RULES: CircuitRules = {
  allowedTopologies: ["series", "parallel"],
  requireClosedCircuit: true,
  requireAllConnected: true,
  forbidShortCircuit: true,
  extraComponents: "warn",
  checkComponentValues: true,
  valueTolerancePercent: 5,
  equivalentResistance: null,
  requireStepsCompleted: true,
  compareToReference: true,
};

const TOPOLOGY_OPTIONS: { value: AllowedTopology; label: string }[] = [
  { value: "series", label: "Series" },
  { value: "parallel", label: "Parallel" },
  { value: "series-parallel", label: "Series-parallel (mixed)" },
  { value: "any", label: "Any topology" },
];

const TOGGLES: { key: keyof CircuitRules; label: string }[] = [
  { key: "requireAllConnected", label: "All components must be connected" },
  {
    key: "requireClosedCircuit",
    label: "Circuit must be closed (when a power source is used)",
  },
  { key: "forbidShortCircuit", label: "Short circuits fail the check" },
  { key: "checkComponentValues", label: "Check component values" },
  {
    key: "compareToReference",
    label:
      "Compare with my wired circuit (electrically equivalent, polarity checked)",
  },
];

type ValidationRulesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labId: string;
  rules: CircuitRules | null;
  onSaved: (rules: CircuitRules | null) => void;
};

const toNumberOrNull = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function ValidationRulesDialog({
  open,
  onOpenChange,
  labId,
  rules,
  onSaved,
}: ValidationRulesDialogProps) {
  // Mounted only while open, so the form starts from the saved rules.
  // Rules saved before a setting existed get its default.
  const [draft, setDraft] = useState<CircuitRules>({
    ...DEFAULT_RULES,
    ...rules,
  });
  const [resistanceMin, setResistanceMin] = useState(
    rules?.equivalentResistance?.min?.toString() ?? "",
  );
  const [resistanceMax, setResistanceMax] = useState(
    rules?.equivalentResistance?.max?.toString() ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<ReferenceAnalysis | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  // The saved circuit, graded the way student circuits will be compared.
  useEffect(() => {
    let cancelled = false;
    getLabReference(labId).then((result) => {
      if (cancelled) return;
      if (result.data) setReference(result.data);
      else setReferenceError(result.error ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [labId]);

  const toggleTopology = (topology: AllowedTopology) => {
    setDraft((prev) => {
      if (topology === "any") return { ...prev, allowedTopologies: ["any"] };
      const withoutAny = prev.allowedTopologies.filter((t) => t !== "any");
      const next = withoutAny.includes(topology)
        ? withoutAny.filter((t) => t !== topology)
        : [...withoutAny, topology];
      return { ...prev, allowedTopologies: next };
    });
  };

  const save = async (next: CircuitRules | null) => {
    if (next && next.allowedTopologies.length === 0) {
      setError("Select at least one accepted topology.");
      return;
    }
    setIsSaving(true);
    setError(null);

    const result = await updateLabRules(labId, next);

    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved(result.data?.circuitRulesJson ?? null);
    onOpenChange(false);
  };

  const handleSave = () => {
    const min = toNumberOrNull(resistanceMin);
    const max = toNumberOrNull(resistanceMax);
    save({
      ...draft,
      equivalentResistance: min === null && max === null ? null : { min, max },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Circuit Validation Rules</DialogTitle>
          <DialogDescription>
            Define what counts as a correct circuit. The equipment placed on the
            canvas is the list of required components. Use the gear icon to give
            them names (e.g. R1) and values, then save the lab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Accepted topologies</Label>
            <div className="flex flex-wrap gap-2">
              {TOPOLOGY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={
                    draft.allowedTopologies.includes(option.value)
                      ? "default"
                      : "outline"
                  }
                  onClick={() => toggleTopology(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {TOGGLES.map((toggle) => (
              <label
                key={toggle.key}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={Boolean(draft[toggle.key])}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [toggle.key]: e.target.checked,
                    }))
                  }
                />
                {toggle.label}
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="valueTolerance">Value tolerance (%)</Label>
              <Input
                id="valueTolerance"
                type="number"
                min={0}
                value={draft.valueTolerancePercent}
                disabled={!draft.checkComponentValues}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    valueTolerancePercent: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Extra components</Label>
              <Select
                value={draft.extraComponents}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    extraComponents: value as CircuitRules["extraComponents"],
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="warn">Allow with a warning</SelectItem>
                  <SelectItem value="fail">Fail the check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Required equivalent resistance (Ω, optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                min={0}
                placeholder="Min"
                value={resistanceMin}
                onChange={(e) => setResistanceMin(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                placeholder="Max"
                value={resistanceMax}
                onChange={(e) => setResistanceMax(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Calculated for resistor networks. Leave empty to skip.
            </p>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Your reference circuit</Label>
              {reference?.debug && (
                <Button
                  type="button"
                  size="sm"
                  variant={showGraph ? "default" : "outline"}
                  onClick={() => setShowGraph((value) => !value)}
                  className="gap-1"
                >
                  <Bug className="h-3 w-3" />
                  {showGraph ? "Hide graph" : "Graph & tree"}
                </Button>
              )}
            </div>
            {referenceError && (
              <p className="text-xs text-muted-foreground">{referenceError}</p>
            )}
            {reference && !reference.hasWires && (
              <p className="text-xs text-muted-foreground">
                No wires saved yet. Wire the parts on the canvas and save the
                lab to grade students against your circuit.
              </p>
            )}
            {reference?.hasWires && (
              <>
                <p className="text-xs text-muted-foreground">
                  Saved circuit: {reference.topology ?? "unknown topology"}
                  {reference.equivalentResistance !== null &&
                    `, Req ${reference.equivalentResistance} Ω`}
                  . Unsaved canvas changes are not included.
                </p>
                <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
                  {reference.fingerprint ?? "not series-parallel"}
                </code>
                {reference.warnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">
                      Your circuit has problems; students who copy it would fail
                      these checks:
                      <ul className="mt-1 list-disc pl-4">
                        {reference.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
            {showGraph && reference?.debug && (
              <CircuitDebugView debug={reference.debug} />
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save rules"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
