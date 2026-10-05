// Shared types for the circuit validation engine.
// The engine is framework-free: it receives plain objects and returns a
// structured result, so it can be unit-tested without Nest or Prisma.

export type ComponentKind =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'led'
  | 'diode'
  | 'power_source'
  | 'switch'
  | 'motor'
  | 'instrument'
  | 'unknown';

export type Topology =
  | 'single'
  | 'series'
  | 'parallel'
  | 'series-parallel'
  | 'complex';

/** Topologies an instructor can allow. "any" accepts every detected topology. */
export type AllowedTopology = 'series' | 'parallel' | 'series-parallel' | 'any';

export type ExtraComponentsPolicy = 'allow' | 'warn' | 'fail';

export type CheckKey =
  | 'requiredComponents'
  | 'extraComponents'
  | 'connections'
  | 'shortCircuit'
  | 'circuitComplete'
  | 'circuitClosed'
  | 'topology'
  | 'equivalentResistance'
  | 'steps';

/** Instructor-defined grading rules, stored in LabInstance.circuitRulesJson. */
export interface CircuitRules {
  allowedTopologies: AllowedTopology[];
  requireClosedCircuit: boolean;
  requireAllConnected: boolean;
  forbidShortCircuit: boolean;
  extraComponents: ExtraComponentsPolicy;
  checkComponentValues: boolean;
  /** Allowed relative deviation of component values, in percent. */
  valueTolerancePercent: number;
  /** Required equivalent resistance range, in ohms. */
  equivalentResistance?: { min?: number | null; max?: number | null } | null;
  requireStepsCompleted: boolean;
  weights?: Partial<Record<CheckKey, number>>;
}

/** A component as seen by the engine (required or placed by the student). */
export interface CircuitComponent {
  id: string;
  label: string;
  kind: ComponentKind;
  value?: number | null;
}

/** A wire between two component handles (canvas handle ids, e.g. "left"). */
export interface CircuitWire {
  from: { componentId: string; handle?: string | null };
  to: { componentId: string; handle?: string | null };
}

export interface CircuitState {
  components: CircuitComponent[];
  wires: CircuitWire[];
}

export interface StepProgress {
  total: number;
  completed: number;
}

export interface CheckResult {
  passed: boolean;
  label: string;
  message: string;
  weight: number;
  detected?: string | number | null;
}

export interface ValidationResult {
  mode: 'rules' | 'legacy';
  passed: boolean;
  score: number;
  // Keyed by CheckKey in rule mode; legacy mode uses its own keys.
  checks: Partial<Record<string, CheckResult>>;
  errors: string[];
  warnings: string[];
  summary: {
    topology: Topology | null;
    equivalentResistance: number | null;
    componentCount: number;
    connectionCount: number;
  };
}
