"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { AxiosError } from "axios";
import api from "./axios";
import { OnboardingFormValues } from "./schemas/onboarding";
import {
  ActionResult,
  CreateLabEquipmentPayload,
  CreateLabPayload,
  CreateModulePayload,
  EquipmentPlacement,
  ExperimentStep,
  Lab,
  LabEquipment,
  LabStats,
  CircuitRules,
  MyLabAttempts,
  LabAttemptSummary,
  StudentCircuitPayload,
  SubmitAttemptResult,
  ValidationResult,
  ReferenceAnalysis,
  ProgressFeedback,
  Module,
  UpdateLabPayload,
  WireConnection,
} from "./types";

const getAuthToken = async () => {
  const { getToken } = await auth();
  return getToken ? await getToken() : null;
};

const parseJsonIfNeeded = (value?: Record<string, unknown> | string) => {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch (error) {
      console.error("Failed to parse defaultConfigJson", error);
      return undefined;
    }
  }

  return value;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || fallback;
  }
  return fallback;
};

export const completeOnboarding = async (formData: OnboardingFormValues) => {
  console.log("[Server] completeOnboarding called with:", formData);

  const { userId } = await auth();
  console.log("[Server] User ID:", userId);

  if (!userId) {
    console.error("[Server] No logged in user");
    return { error: "No logged in user" };
  }

  const client = await clerkClient();

  try {
    console.log("[Server] Updating user metadata...");
    await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
        role: formData.role,
        institution: formData.institution,
      },
    });
    console.log("[Server] User metadata updated successfully");

    // Force session to refresh by updating Clerk user
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        onboardingComplete: true,
        role: formData.role,
        institution: formData.institution,
      },
    });

    return { message: "Onboarding complete", success: true };
  } catch (err) {
    console.error("[Server] Error updating user metadata:", err);
    return { error: "There was an error updating the user metadata." };
  }
};

export const getLabEquipments = async (): Promise<
  ActionResult<LabEquipment[]>
> => {
  try {
    const token = await getAuthToken();

    const response = await api.get<LabEquipment[]>("/lab-equipment", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load lab equipment.") };
  }
};

export const createLabEquipment = async (
  payload: CreateLabEquipmentPayload,
): Promise<ActionResult<LabEquipment>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to create lab equipment." };
    }

    const body = {
      equipmentType: payload.equipmentType,
      equipmentName: payload.equipmentName,
      description: payload.description || undefined,
      supportsConfiguration: payload.supportsConfiguration ?? false,
      defaultConfigJson: parseJsonIfNeeded(payload.defaultConfigJson),
    };

    const response = await api.post<LabEquipment>("/lab-equipment", body, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = response.data;

    if (payload.image) {
      const imageFormData = new FormData();
      imageFormData.append("image", payload.image);

      const imageResponse = await api.put<LabEquipment>(
        `/lab-equipment/${data.id}/image`,
        imageFormData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return { data: imageResponse.data };
    }

    return { data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to create lab equipment.") };
  }
};

// ============ MODULE ACTIONS ============

export const getModules = async (): Promise<ActionResult<Module[]>> => {
  try {
    const token = await getAuthToken();

    const response = await api.get<Module[]>("/modules", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load modules.") };
  }
};

export const getMyModules = async (): Promise<ActionResult<Module[]>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in." };
    }

    const response = await api.get<Module[]>("/modules/my-modules", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load your modules.") };
  }
};

export const createModule = async (
  payload: CreateModulePayload,
): Promise<ActionResult<Module>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to create a module." };
    }

    const response = await api.post<Module>("/modules", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to create module.") };
  }
};

export const updateModule = async (
  id: string,
  payload: Partial<CreateModulePayload>,
): Promise<ActionResult<Module>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to update a module." };
    }

    const response = await api.patch<Module>(`/modules/${id}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to update module.") };
  }
};

// ============ LAB ACTIONS ============

export const getLabs = async (): Promise<ActionResult<Lab[]>> => {
  try {
    const token = await getAuthToken();

    const response = await api.get<Lab[]>("/labs", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load labs.") };
  }
};

export const getMyLabs = async (): Promise<ActionResult<Lab[]>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in." };
    }

    const response = await api.get<Lab[]>("/labs/my-labs", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load your labs.") };
  }
};

export const getPublishedLabs = async (): Promise<ActionResult<Lab[]>> => {
  try {
    const token = await getAuthToken();

    // Get all labs - in a real app, you'd filter for published labs
    const response = await api.get<Lab[]>("/labs", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load labs.") };
  }
};

export const getLabStats = async (): Promise<ActionResult<LabStats>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in." };
    }

    const response = await api.get<LabStats>("/labs/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load stats.") };
  }
};

export const getLab = async (id: string): Promise<ActionResult<Lab>> => {
  try {
    const token = await getAuthToken();

    const response = await api.get<Lab>(`/labs/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load lab.") };
  }
};

export const createLab = async (
  payload: CreateLabPayload,
): Promise<ActionResult<Lab>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to create a lab." };
    }

    const response = await api.post<Lab>("/labs", payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to create lab.") };
  }
};

export const updateLab = async (
  id: string,
  payload: UpdateLabPayload,
): Promise<ActionResult<Lab>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to update a lab." };
    }

    const response = await api.put<Lab>(`/labs/${id}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to update lab.") };
  }
};

export const updateLabEquipments = async (
  id: string,
  equipments: Omit<EquipmentPlacement, "id" | "equipment">[],
): Promise<ActionResult<Lab>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to update lab equipments." };
    }

    const response = await api.put<Lab>(
      `/labs/${id}/equipments`,
      { equipments },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return {
      error: getErrorMessage(error, "Failed to update lab equipments."),
    };
  }
};

export const updateLabSteps = async (
  id: string,
  steps: Omit<ExperimentStep, "id" | "labId" | "createdAt">[],
): Promise<ActionResult<Lab>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to update lab steps." };
    }

    const response = await api.put<Lab>(
      `/labs/${id}/steps`,
      { steps },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to update lab steps.") };
  }
};

export const deleteLab = async (id: string): Promise<ActionResult<void>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to delete a lab." };
    }

    await api.delete(`/labs/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return {};
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to delete lab.") };
  }
};

export const updateLabConnections = async (
  id: string,
  connections: Omit<WireConnection, "id" | "labId">[],
): Promise<ActionResult<Lab>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to update lab connections." };
    }

    const response = await api.put<Lab>(
      `/labs/${id}/connections`,
      { connections },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return {
      error: getErrorMessage(error, "Failed to update lab connections."),
    };
  }
};

export const updateLabRules = async (
  id: string,
  rules: CircuitRules | null,
): Promise<ActionResult<Lab>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to update lab rules." };
    }

    const response = await api.put<Lab>(
      `/labs/${id}/rules`,
      { rules },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to update lab rules.") };
  }
};

export const getLabReference = async (
  id: string,
): Promise<ActionResult<ReferenceAnalysis>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to view the reference circuit." };
    }

    const response = await api.get<ReferenceAnalysis>(`/labs/${id}/reference`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return {
      error: getErrorMessage(error, "Failed to load the reference circuit."),
    };
  }
};

export const validateLabCircuit = async (
  id: string,
  payload: StudentCircuitPayload,
): Promise<ActionResult<ValidationResult>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to check your circuit." };
    }

    const response = await api.post<ValidationResult>(
      `/labs/${id}/validate`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to check your circuit.") };
  }
};

/**
 * AI explanation of the current circuit's Check Progress result. The backend
 * re-validates the workspace itself; only part identities and wires are sent.
 */
export const getProgressFeedback = async (
  labId: string,
  payload: StudentCircuitPayload,
  currentStepIndex: number,
): Promise<ActionResult<ProgressFeedback>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to get AI feedback." };
    }

    const response = await api.post<ProgressFeedback>(
      "/ai/progress-feedback",
      {
        context: {
          labId,
          currentStepIndex,
          workspace: {
            components: payload.components.map((c) => ({
              id: c.id,
              equipmentId: c.equipmentId,
              labEquipmentId: c.labEquipmentId ?? undefined,
            })),
            connections: payload.connections.map((conn) => ({
              sourceEquipmentId: conn.sourceEquipmentId,
              targetEquipmentId: conn.targetEquipmentId,
              sourceHandle: conn.sourceHandle ?? undefined,
              targetHandle: conn.targetHandle ?? undefined,
            })),
          },
        },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 45000,
      },
    );

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return {
      error: getErrorMessage(error, "AI feedback is unavailable right now."),
    };
  }
};

export const submitLabAttempt = async (
  id: string,
  payload: StudentCircuitPayload,
): Promise<ActionResult<SubmitAttemptResult>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to submit your lab." };
    }

    const response = await api.post<SubmitAttemptResult>(
      `/labs/${id}/attempts`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to submit your lab.") };
  }
};

export const getMyLabAttempts = async (
  id: string,
): Promise<ActionResult<MyLabAttempts>> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to view your attempts." };
    }

    const response = await api.get<MyLabAttempts>(`/labs/${id}/attempts/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load your attempts.") };
  }
};

export const getMyAttemptSummary = async (): Promise<
  ActionResult<LabAttemptSummary[]>
> => {
  try {
    const token = await getAuthToken();

    if (!token) {
      return { error: "You must be signed in to view your progress." };
    }

    const response = await api.get<LabAttemptSummary[]>("/labs/my-attempts", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { data: response.data };
  } catch (error) {
    console.error(error);
    return { error: getErrorMessage(error, "Failed to load your progress.") };
  }
};
