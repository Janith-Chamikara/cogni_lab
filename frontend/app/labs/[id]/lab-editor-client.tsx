"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Play, Save, Trash2, Settings } from "lucide-react";
import {
  Lab,
  LabEquipment,
  EquipmentPlacement,
  ExperimentStep,
  WireConnection,
} from "@/lib/types";
import {
  updateLabEquipments,
  updateLabSteps,
  updateLabConnections,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { EquipmentSidebar } from "@/components/lab/equipment-sidebar";
import {
  CircuitCanvas,
  PlacedEquipment,
} from "@/components/lab/circuit-canvas";
import { StepsSidebar } from "@/components/lab/steps-sidebar";
import { ThresholdsDialog } from "@/components/lab/thresholds-dialog";
import { EquipmentConfigDialog } from "@/components/lab/equipment-config-dialog";
import { useAuth } from "@clerk/nextjs";

type LabEditorClientProps = {
  lab: Lab;
  availableEquipments: LabEquipment[];
};

export function LabEditorClient({
  lab,
  availableEquipments,
}: LabEditorClientProps) {
  const [placedEquipments, setPlacedEquipments] = useState<PlacedEquipment[]>(
    () =>
      (lab.labEquipments || []).map((eq) => ({
        ...eq,
        equipment: eq.equipment!,
      })),
  );

  const [wireConnections, setWireConnections] = useState<WireConnection[]>(
    lab.wireConnections || [],
  );

  const [steps, setSteps] = useState<ExperimentStep[]>(
    lab.experimentSteps || [],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);
  const [configEquipment, setConfigEquipment] =
    useState<PlacedEquipment | null>(null);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);

  const { getToken } = useAuth();
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: "assistant" | "user"; content: string }[]
  >([
    { role: "assistant", content: "Hi, how can I help you today?" },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);
  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isChatSending) return;

    const newMessage = { role: "user" as const, content: trimmed };
    const nextMessages = [...chatMessages, newMessage];

    setChatMessages(nextMessages);
    setChatInput("");
    setIsChatSending(true);

    try {
      const token = await getToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

      if (!token) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Please sign in to use AI chat.",
          },
        ]);
        return;
      }

      if (!baseUrl) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Missing NEXT_PUBLIC_API_BASE_URL.",
          },
        ]);
        return;
      }

      const response = await fetch(`${baseUrl}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "AI request failed." },
        ]);
        return;
      }

      const data = await response.json();
      const reply = data?.reply || "Sorry, I couldn't respond.";
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to reach the AI service." },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  const handleEquipmentDrop = useCallback(
    (equipmentId: string, x: number, y: number) => {
      const equipment = availableEquipments.find((eq) => eq.id === equipmentId);
      if (equipment) {
        const newPlacement: PlacedEquipment = {
          id: `temp-${Date.now()}`,
          equipmentId: equipment.id,
          positionX: x,
          positionY: y,
          positionZ: placedEquipments.length,
          configJson:
            (equipment.defaultConfigJson as Record<string, unknown>) || null,
          equipment,
        };
        setPlacedEquipments((prev) => [...prev, newPlacement]);
      }
    },
    [availableEquipments, placedEquipments.length],
  );

  const handleEquipmentMove = useCallback(
    (index: number, x: number, y: number) => {
      setPlacedEquipments((prev) =>
        prev.map((eq, i) =>
          i === index ? { ...eq, positionX: x, positionY: y } : eq,
        ),
      );
    },
    [],
  );

  const handleEquipmentRemove = useCallback(
    (index: number) => {
      const removedEquipment = placedEquipments[index];
      setPlacedEquipments((prev) => prev.filter((_, i) => i !== index));
      if (removedEquipment.id) {
        setWireConnections((prev) =>
          prev.filter(
            (conn) =>
              conn.sourceEquipmentId !== removedEquipment.id &&
              conn.targetEquipmentId !== removedEquipment.id,
          ),
        );
      }
    },
    [placedEquipments],
  );

  const handleConnectionsChange = useCallback(
    (connections: WireConnection[]) => {
      setWireConnections(connections);
    },
    [],
  );

  const handleEquipmentConfig = useCallback(
    (index: number) => {
      setConfigEquipment(placedEquipments[index]);
    },
    [placedEquipments],
  );

  const handleConfigSave = useCallback(
    (config: Record<string, unknown>) => {
      if (!configEquipment) return;

      setPlacedEquipments((prev) =>
        prev.map((eq) =>
          eq.equipmentId === configEquipment.equipmentId &&
          eq.positionX === configEquipment.positionX &&
          eq.positionY === configEquipment.positionY
            ? { ...eq, configJson: config }
            : eq,
        ),
      );
      setConfigEquipment(null);
    },
    [configEquipment],
  );

  const handleSave = async () => {
    setIsSaving(true);

    const equipmentResult = await updateLabEquipments(
      lab.id,
      placedEquipments.map((eq) => ({
        equipmentId: eq.equipmentId,
        positionX: eq.positionX,
        positionY: eq.positionY,
        positionZ: eq.positionZ,
        configJson: eq.configJson || undefined,
      })),
    );

    if (equipmentResult.data?.labEquipments) {
      const newEquipments = equipmentResult.data.labEquipments.map((eq) => ({
        ...eq,
        equipment: eq.equipment!,
      }));
      setPlacedEquipments(newEquipments);

      const idMap = new Map<string, string>();
      placedEquipments.forEach((oldEq, index) => {
        if (newEquipments[index]) {
          idMap.set(oldEq.id || `temp-${index}`, newEquipments[index].id!);
        }
      });

      const updatedConnections = wireConnections.map((conn) => ({
        ...conn,
        sourceEquipmentId:
          idMap.get(conn.sourceEquipmentId) || conn.sourceEquipmentId,
        targetEquipmentId:
          idMap.get(conn.targetEquipmentId) || conn.targetEquipmentId,
      }));

      await updateLabConnections(lab.id, updatedConnections);
    }

    await updateLabSteps(
      lab.id,
      steps.map((step) => ({
        stepNumber: step.stepNumber,
        stepDescription: step.stepDescription,
        procedure: step.procedure || undefined,
        minTolerance: step.minTolerance || undefined,
        maxTolerance: step.maxTolerance || undefined,
        unit: step.unit || undefined,
      })),
    );

    setIsSaving(false);
  };

  const handleAddStep = () => {
    const newStep: ExperimentStep = {
      stepNumber: steps.length + 1,
      stepDescription: "New step",
      procedure: "",
    };
    setSteps([...steps, newStep]);
  };

  const handleUpdateStep = (
    index: number,
    updates: Partial<ExperimentStep>,
  ) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step)),
    );
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, stepNumber: i + 1 })),
    );
  };

  return (
    <div className="mx-auto flex h-screen max-w-10/12 flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">{lab.labName}</h1>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsThresholdsOpen(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Set Thresholds
          </Button>
          <Button variant="outline" size="sm">
            <Play className="mr-2 h-4 w-4" />
            Run
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Discard
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <StepsSidebar
          objective={lab.description || ""}
          steps={steps}
          onAddStep={handleAddStep}
          onUpdateStep={handleUpdateStep}
          onRemoveStep={handleRemoveStep}
        />

        <div className="relative flex-1">
          <CircuitCanvas
            placedEquipments={placedEquipments}
            wireConnections={wireConnections}
            onEquipmentMove={handleEquipmentMove}
            onEquipmentRemove={handleEquipmentRemove}
            onEquipmentConfig={handleEquipmentConfig}
            onConnectionsChange={handleConnectionsChange}
            onEquipmentDrop={handleEquipmentDrop}
          />
        </div>

        <EquipmentSidebar equipments={availableEquipments} />
      </div>

      <ThresholdsDialog
        open={isThresholdsOpen}
        onOpenChange={setIsThresholdsOpen}
        lab={lab}
      />

      {configEquipment && (
        <EquipmentConfigDialog
          open={!!configEquipment}
          onOpenChange={(open: boolean) => !open && setConfigEquipment(null)}
          equipment={configEquipment.equipment}
          currentConfig={configEquipment.configJson || {}}
          onSave={handleConfigSave}
        />
      )}
      <button
        type="button"
        onClick={() => setIsAiChatOpen((open) => !open)}
        className="fixed bottom-6 right-6 z-50 flex h-20 w-20 items-center justify-center rounded-full border border-white/40 bg-white/90 shadow-lg transition active:scale-95 hover:shadow-xl"
        aria-label="Toggle AI chat"
      >
        <Image
          src="/Avatar.png"
          alt="AI Assistant"
          width={64}
          height={64}
          className="rounded-full object-cover"
          priority
        />
      </button>

      {isAiChatOpen && (
        <div className="fixed bottom-28 right-6 z-50 h-[400px] w-[350px] sm:w-[414px] rounded-[12px] border border-black/10 bg-white shadow-xl">
          <div className="flex h-full flex-col p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-full border border-black/10">
                <Image
                  src="/Avatar.png"
                  alt="Assistant"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="text-sm font-semibold">Assistant</div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2">
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`mb-2 flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-[#1b1b1b] text-white"
                        : "bg-[#f2f2f2] text-black"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isChatSending && (
                <div className="text-xs animate-pulse text-muted-foreground">
                  Assistant is thinking...
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleChatSend();
                }}
                className="h-10 flex-1 rounded-lg border border-black/10 px-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={handleChatSend}
                disabled={isChatSending || !chatInput.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 bg-white shadow-sm disabled:opacity-50"
                aria-label="Send"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22l-4-9-9-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
