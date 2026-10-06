"use client";

import { useEffect, useState } from "react";
import { Bug, RefreshCw, X } from "lucide-react";
import { getLabReference, validateLabCircuit } from "@/lib/actions";
import type {
  ReferenceAnalysis,
  StudentCircuitPayload,
  ValidationDebug,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ComparisonDebugView, CircuitDebugView } from "./circuit-debug-view";

// Developer tool: shows circuit graphs, series/parallel trees and
// fingerprints. The button appears only when NEXT_PUBLIC_CIRCUIT_DEBUG=true;
// the backend returns details only to instructors/admins or when
// CIRCUIT_DEBUG=true.

export const isCircuitDebugEnabled = () =>
  process.env.NEXT_PUBLIC_CIRCUIT_DEBUG === "true";

function DebugButton({
  open,
  onToggle,
  hint,
}: {
  open: boolean;
  onToggle: () => void;
  hint: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={open ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
            aria-label="Circuit debug"
            aria-pressed={open}
          >
            <Bug className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{open ? "Hide circuit debug" : hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Floating panel docked on the left (over the instructions), so the canvas,
 * equipment list, minimap and chat button stay visible.
 */
function DebugPanel({
  title,
  loading,
  error,
  onRefresh,
  onClose,
  children,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed left-4 top-28 z-50 flex max-h-[calc(100vh-8rem)] w-[min(520px,calc(100vw-2rem))] flex-col rounded-lg border bg-background shadow-2xl">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Bug className="h-4 w-4" />
        <span className="font-semibold">{title}</span>
        {loading && (
          <span className="text-xs text-muted-foreground">updating…</span>
        )}
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-y-auto p-4">
        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {children}
      </div>
    </div>
  );
}

const NO_DEBUG_MESSAGE =
  "The server did not return debug details. Sign in as an instructor, or set CIRCUIT_DEBUG=true on the backend.";

/** Student editor: live graph of the student's circuit vs the instructor's. */
export function CircuitDebugToggle({
  labId,
  payload,
}: {
  labId: string;
  payload: StudentCircuitPayload;
}) {
  const [open, setOpen] = useState(false);
  const [debug, setDebug] = useState<ValidationDebug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  // Re-run only when the circuit itself changes, not on every render.
  const payloadKey = JSON.stringify(payload);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await validateLabCircuit(labId, {
        ...(JSON.parse(payloadKey) as StudentCircuitPayload),
        debug: true,
      });
      if (cancelled) return;
      setLoading(false);
      if (result.error || !result.data) {
        setError(result.error ?? "Failed to load debug details.");
        return;
      }
      if (!result.data.debug) {
        setError(NO_DEBUG_MESSAGE);
        return;
      }
      setError(null);
      setDebug(result.data.debug);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, labId, payloadKey, refreshCount]);

  if (!isCircuitDebugEnabled()) return null;

  return (
    <>
      <DebugButton
        open={open}
        onToggle={() => setOpen((value) => !value)}
        hint="Show graph, tree and fingerprint"
      />
      {open && (
        <DebugPanel
          title="Circuit debug"
          loading={loading}
          error={error}
          onRefresh={() => setRefreshCount((n) => n + 1)}
          onClose={() => setOpen(false)}
        >
          {debug ? (
            <Tabs defaultValue="student">
              <TabsList>
                <TabsTrigger value="student">Student</TabsTrigger>
                <TabsTrigger value="reference" disabled={!debug.reference}>
                  Instructor
                </TabsTrigger>
                <TabsTrigger value="compare" disabled={!debug.comparison}>
                  Compare
                </TabsTrigger>
              </TabsList>
              <TabsContent value="student" className="pt-3">
                <CircuitDebugView debug={debug.student} />
              </TabsContent>
              <TabsContent value="reference" className="pt-3">
                {debug.reference && (
                  <CircuitDebugView debug={debug.reference} />
                )}
              </TabsContent>
              <TabsContent value="compare" className="pt-3">
                {debug.comparison && (
                  <ComparisonDebugView
                    comparison={debug.comparison}
                    studentFingerprint={debug.student.fingerprint}
                    referenceFingerprint={debug.reference?.fingerprint ?? null}
                  />
                )}
              </TabsContent>
            </Tabs>
          ) : (
            !error && <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </DebugPanel>
      )}
    </>
  );
}

/**
 * Instructor editor: the saved reference circuit as the grader sees it.
 * `savedVersion` changes after each save, which reloads the panel.
 */
export function ReferenceDebugToggle({
  labId,
  savedVersion,
}: {
  labId: string;
  savedVersion: number;
}) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState<ReferenceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const result = await getLabReference(labId);
      if (cancelled) return;
      setLoading(false);
      if (!result.data) {
        setError(result.error ?? "Failed to load the reference circuit.");
        return;
      }
      setError(result.data.debug ? null : NO_DEBUG_MESSAGE);
      setReference(result.data);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, labId, savedVersion, refreshCount]);

  if (!isCircuitDebugEnabled()) return null;

  return (
    <>
      <DebugButton
        open={open}
        onToggle={() => setOpen((value) => !value)}
        hint="Show the saved circuit's graph, tree and fingerprint"
      />
      {open && (
        <DebugPanel
          title="Reference circuit debug"
          loading={loading}
          error={error}
          onRefresh={() => setRefreshCount((n) => n + 1)}
          onClose={() => setOpen(false)}
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Shows the last saved circuit. Save to include canvas changes.
          </p>
          {reference && !reference.hasWires && (
            <p className="text-sm text-muted-foreground">
              No wires saved yet, so students are not compared with a reference
              circuit.
            </p>
          )}
          {reference && reference.warnings.length > 0 && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <p className="mb-1 font-semibold text-destructive">
                Problems students would fail on:
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {reference.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {reference?.debug ? (
            <CircuitDebugView debug={reference.debug} />
          ) : (
            !error && <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </DebugPanel>
      )}
    </>
  );
}
