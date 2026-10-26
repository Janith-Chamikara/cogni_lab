export type LabEquipment = {
  id: string;
  equipmentType: string;
  equipmentName: string;
  description?: string | null;
  supportsConfiguration: boolean;
  defaultConfigJson?: Record<string, unknown> | string | null;
  imageUrl?: string | null;
  /** Named connection points drawn as canvas handles (from the API). */
  terminals?: TerminalSpec[];
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
  /** Compare student circuits with the instructor's wired circuit. */
  compareToReference?: boolean;
  weights?: Record<string, number>;
};

export type TerminalSpec = {
  /** Handle id stored on wires, e.g. "pos". */
  id: string;
  /** Short label drawn next to the handle, e.g. "+". */
  label: string;
  name: string;
  side: "left" | "right" | "top" | "bottom";
};

export type ValidationCheck = {
  passed: boolean;
  label: string;
  message: string;
  weight: number;
  /** Share of the weight earned although the check failed (0-1). */
  partial?: number;
  detected?: string | number | null;
};

export type ValidationResult = {
  mode: "rules";
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
  /** Only when debugging is enabled (see CircuitDebugToggle). */
  debug?: ValidationDebug;
};

// Circuit debug details (mirror backend/src/circuit-validation/types.ts)
export type Orientation = "forward" | "reverse";
export type Relation = "series" | "parallel";

export type DebugTree =
  | {
      type: "leaf";
      elementId: string;
      label: string;
      token: string;
      from: string;
      to: string;
    }
  | {
      type: "series" | "parallel";
      token: string;
      from: string;
      to: string;
      children: DebugTree[];
    };

export type CircuitDebug = {
  nodes: { id: string; terminals: string[] }[];
  elements: {
    id: string;
    label: string;
    token: string;
    nodes: [string, string];
    role: string;
    polar: boolean;
    orientation: Orientation | null;
    inTree: boolean;
  }[];
  source: string | null;
  ports: { plus: string; minus: string } | null;
  tree: DebugTree | null;
  fingerprint: string | null;
  topology: string | null;
};

export type ComparisonDebug = {
  match: boolean;
  method: "tree" | "partition" | "none";
  mapping: { student: string; reference: string }[];
  pairs: {
    a: string;
    b: string;
    reference: Relation;
    student: Relation | null;
  }[];
  polarity: { label: string; reference: Orientation; student: Orientation }[];
  partialScore: number;
};

export type ValidationDebug = {
  student: CircuitDebug;
  reference: CircuitDebug | null;
  comparison: ComparisonDebug | null;
};

/** POST /ai/progress-feedback: AI explanation of a Check Progress result. */
export type ProgressFeedback = {
  reply: string;
  score: number;
  passed: boolean;
};

/** GET /labs/:id/reference: the instructor's circuit as the grader sees it. */
export type ReferenceAnalysis = {
  hasWires: boolean;
  fingerprint: string | null;
  topology: string | null;
  equivalentResistance: number | null;
  warnings: string[];
  debug: CircuitDebug | null;
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
  /** Ask for graph/tree/fingerprint details (instructors or CIRCUIT_DEBUG). */
  debug?: boolean;
};

export type LabAttempt = {
  id: string;
  score: number;
  passed: boolean;
  /** "legacy" only on attempts stored before basic grading was removed. */
  validationMode: "rules" | "legacy";
  validationResultJson: ValidationResult;
  submittedAt: string;
};

export type MyLabAttempts = {
  attempts: LabAttempt[];
  bestAttempt: LabAttempt | null;
  /** The latest submission's circuit, shown again when the student returns. */
  latestSubmission: {
    attemptId: string;
    submittedAt: string;
    passed: boolean;
    circuit: unknown;
  } | null;
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
