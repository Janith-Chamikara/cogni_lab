export type LabEquipment = {
  id: string;
  equipmentType: string;
  equipmentName: string;
  description?: string | null;
  supportsConfiguration: boolean;
  defaultConfigJson?: Record<string, unknown> | string | null;
  imageUrl?: string | null;
  creator?: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
  createdAt?: string;
};

export type ActionResult<T> = {
  data?: T;
  error?: string;
};

export type CreateLabEquipmentPayload = {
  equipmentType: string;
  equipmentName: string;
  description?: string;
  supportsConfiguration?: boolean;
  defaultConfigJson?: Record<string, unknown> | string;
  image?: File | null;
};

// Module types
export type Module = {
  id: string;
  instructorId: string;
  moduleName: string;
  description?: string | null;
  moduleCode?: string | null;
  createdAt: string;
  updatedAt: string;
  instructor?: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
  _count?: {
    labInstances: number;
  };
};

export type CreateModulePayload = {
  moduleName: string;
  description?: string;
  moduleCode?: string;
};

// Lab types
export type LabStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type EquipmentPlacement = {
  id?: string;
  equipmentId: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  configJson?: Record<string, unknown> | null;
  equipment?: LabEquipment;
  /** Label used by circuit validation (e.g. R1), returned by GET /labs/:id. */
  componentLabel?: string;
};

export type ExperimentStep = {
  id?: string;
  labId?: string;
  stepNumber: number;
  stepDescription: string;
  procedure?: string | null;
  minTolerance?: number | null;
  maxTolerance?: number | null;
  unit?: string | null;
  createdAt?: string;
};

// Wire connection types
export type WireConnection = {
  id?: string;
  labId?: string;
  sourceEquipmentId: string;
  targetEquipmentId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  wireColor?: string;
};

export type Lab = {
  id: string;
  instructorId: string;
  moduleId: string;
  labName: string;
  description?: string | null;
  toleranceMin?: number | null;
  toleranceMax?: number | null;
  toleranceUnit?: string | null;
  circuitRulesJson?: CircuitRules | null;
  completionStatus: LabStatus;
  createdAt: string;
  updatedAt: string;
  instructor?: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
  module?: {
    id: string;
    moduleName: string;
    moduleCode?: string | null;
  };
  labEquipments?: EquipmentPlacement[];
  wireConnections?: WireConnection[];
  experimentSteps?: ExperimentStep[];
  _count?: {
    experimentSteps: number;
    labEquipments: number;
    experimentProgress: number;
  };
};

export type CreateLabPayload = {
  moduleId: string;
  labName: string;
  description?: string;
  category?: string;
  toleranceMin?: number;
  toleranceMax?: number;
  toleranceUnit?: string;
  equipments?: Omit<EquipmentPlacement, "id" | "equipment">[];
  steps?: Omit<ExperimentStep, "id" | "labId" | "createdAt">[];
};

export type UpdateLabPayload = {
  labName?: string;
  description?: string;
  category?: string;
  toleranceMin?: number;
  toleranceMax?: number;
  toleranceUnit?: string;
};

export type LabStats = {
  totalLabs: number;
  activeLabs: number;
  totalProgress: number;
};

// Circuit validation types (mirror backend/src/circuit-validation/types.ts)
export type AllowedTopology = "series" | "parallel" | "series-parallel" | "any";

export type CircuitRules = {
  allowedTopologies: AllowedTopology[];
  requireClosedCircuit: boolean;
  requireAllConnected: boolean;
  forbidShortCircuit: boolean;
  extraComponents: "allow" | "warn" | "fail";
  checkComponentValues: boolean;
  valueTolerancePercent: number;
  equivalentResistance?: { min?: number | null; max?: number | null } | null;
  requireStepsCompleted: boolean;
  weights?: Record<string, number>;
};

export type ValidationCheck = {
  passed: boolean;
  label: string;
  message: string;
  weight: number;
  detected?: string | number | null;
};

export type ValidationResult = {
  mode: "rules" | "legacy";
  passed: boolean;
  score: number;
  checks: Record<string, ValidationCheck>;
  errors: string[];
  warnings: string[];
  summary: {
    topology: string | null;
    equivalentResistance: number | null;
    componentCount: number;
    connectionCount: number;
  };
};

export type StudentComponent = {
  id: string;
  equipmentId: string;
  labEquipmentId?: string;
  positionX: number;
  positionY: number;
};

export type StudentAction = {
  action: "ADD" | "REMOVE" | "CONNECT" | "DISCONNECT";
  componentId?: string;
  from?: string;
  to?: string;
  timestamp: string;
};

export type StudentCircuitPayload = {
  components: StudentComponent[];
  connections: Omit<WireConnection, "id" | "labId">[];
  completedStepIds: string[];
  actionLog?: StudentAction[];
};

export type LabAttempt = {
  id: string;
  score: number;
  passed: boolean;
  validationMode: "rules" | "legacy";
  validationResultJson: ValidationResult;
  submittedAt: string;
};

export type MyLabAttempts = {
  attempts: LabAttempt[];
  bestAttempt: LabAttempt | null;
};

export type SubmitAttemptResult = {
  attempt: LabAttempt;
  result: ValidationResult;
  bestAttempt: LabAttempt | null;
};

/** A student's result for one lab, based on their best attempt. */
export type LabAttemptSummary = {
  labId: string;
  attemptCount: number;
  bestScore: number;
  passed: boolean;
};
