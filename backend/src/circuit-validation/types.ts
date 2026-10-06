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
  | 'potentiometer'
  | 'ammeter'
  | 'voltmeter'
  | 'multimeter'
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
  | 'steps'
  | 'matchesReference'
  | 'polarity'
  | 'instruments';

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
  /** Compare the student's circuit with the instructor's wired circuit. */
  compareToReference: boolean;
  weights?: Partial<Record<CheckKey, number>>;
}

export type TerminalSide = 'left' | 'right' | 'top' | 'bottom';

/** A named connection point of a component (a canvas handle). */
export interface TerminalSpec {
  /** Handle id stored on wires, e.g. "pos". */
  id: string;
  /** Short label shown on the canvas, e.g. "+". */
  label: string;
  /** Name used in messages, e.g. "positive terminal". */
  name: string;
  side: TerminalSide;
}

/** A component as seen by the engine (required or placed by the student). */
export interface CircuitComponent {
  id: string;
  label: string;
  kind: ComponentKind;
  value?: number | null;
  /** Instructor placement this component comes from (student circuits). */
  refId?: string | null;
  /** Extra numeric settings, e.g. a potentiometer's wiperPosition (0-1). */
  params?: Record<string, number>;
  /** Terminal override from the equipment config (same count as the kind). */
  terminals?: TerminalSpec[] | null;
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
  /** Share of the weight earned when the check fails (0-1), if partial. */
  partial?: number;
  detected?: string | number | null;
}

export interface ValidationResult {
  mode: 'rules';
  passed: boolean;
  score: number;
  // Keyed by CheckKey.
  checks: Partial<Record<string, CheckResult>>;
  errors: string[];
  warnings: string[];
  summary: {
    topology: Topology | null;
    equivalentResistance: number | null;
    componentCount: number;
    connectionCount: number;
  };
  /** Graph, tree and fingerprint details, only when debugging is enabled. */
  debug?: ValidationDebug;
}

export type Orientation = 'forward' | 'reverse';
export type Relation = 'series' | 'parallel';

export type DebugTree =
  | {
      type: 'leaf';
      elementId: string;
      label: string;
      token: string;
      from: string;
      to: string;
    }
  | {
      type: 'series' | 'parallel';
      token: string;
      from: string;
      to: string;
      children: DebugTree[];
    };

export interface CircuitDebug {
  nodes: Array<{ id: string; terminals: string[] }>;
  elements: Array<{
    id: string;
    label: string;
    token: string;
    nodes: [string, string];
    role: string;
    polar: boolean;
    orientation: Orientation | null;
    inTree: boolean;
  }>;
  source: string | null;
  ports: { plus: string; minus: string } | null;
  tree: DebugTree | null;
  fingerprint: string | null;
  topology: Topology | null;
}

export interface ComparisonDebug {
  match: boolean;
  method: 'tree' | 'partition' | 'none';
  mapping: Array<{ student: string; reference: string }>;
  pairs: Array<{
    a: string;
    b: string;
    reference: Relation;
    student: Relation | null;
  }>;
  polarity: Array<{
    label: string;
    reference: Orientation;
    student: Orientation;
  }>;
  partialScore: number;
}

export interface ValidationDebug {
  student: CircuitDebug;
  reference: CircuitDebug | null;
  comparison: ComparisonDebug | null;
}
