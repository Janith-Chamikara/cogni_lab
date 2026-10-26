// Shared types for the circuit validation engine.
// The engine is framework-free: it receives plain objects and returns a
// structured result, so it can be unit-tested without Nest or Prisma.

/** Kinds that have a built-in preset (see component-presets.ts). */
export type BuiltInKind =
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

/**
 * A component kind: a built-in one or any id an equipment creator defines.
 * Required and placed components only match when their kinds are equal.
 */
export type ComponentKind = string;

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

/** How a branch acts in the circuit. Ammeters conduct, voltmeters do not. */
export type BranchRole = 'load' | 'voltmeter' | 'ammeter';

/**
 * A two-terminal path through a component, as the engine uses it. Most
 * components have one branch; a multimeter or potentiometer has several and
 * uses the ones that are wired.
 */
export interface BranchSpec {
  id: string;
  /** Terminal indexes. For polar branches current must enter at [0]. */
  between: [number, number];
  polar?: boolean;
  role?: BranchRole;
  /** Fingerprint code when it differs from the component's code. */
  code?: string;
  /**
   * Share of the component value carried by this branch: the param's value
   * (0-1), or one minus it when inverted (potentiometer halves).
   */
  share?: { param: string; invert?: boolean };
}

/** Branches to use when all `whenWired` terminals (indexes) have wires. */
export interface BranchMode {
  whenWired: number[];
  branches: string[];
}

export type ConfigFieldType = 'number' | 'text' | 'select';

/** A setting shown when a component is configured in a lab. */
export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
  default?: number | string;
}

/** A component definition compiled for the engine (terminal indexes). */
export interface ComponentSpec {
  kind: ComponentKind;
  /** Short prefix used for auto labels, e.g. "R" -> R1, R2. */
  labelPrefix: string;
  /** Code used in circuit fingerprints, e.g. "R" -> R:100. */
  code: string;
  terminals: TerminalSpec[];
  branches: BranchSpec[];
  /** First matching mode picks the branches. No match: every branch. */
  modes?: BranchMode[];
  /** Config field that holds the component's primary value. */
  valueKey?: string;
  unit?: string;
  /** Power sources define the ports of the circuit. */
  isSource?: boolean;
  /** Index of the positive terminal of a source. */
  plusTerminal?: number;
  /** Instruments measure the circuit; they are not part of the load. */
  isInstrument?: boolean;
  /** Counts towards the equivalent resistance. */
  resistive?: boolean;
  fields: ConfigField[];
}

export type ComponentRole = 'load' | 'source' | 'instrument';

/**
 * A component definition as an equipment creator writes it and as it is
 * stored (LabEquipment.componentSpecJson). Terminals are referenced by id.
 */
export interface ComponentDefinition {
  kind: ComponentKind;
  labelPrefix: string;
  code?: string;
  role: ComponentRole;
  resistive?: boolean;
  terminals: TerminalSpec[];
  /** Sources only: the id of the positive terminal. */
  positiveTerminal?: string;
  /** Polar branches: current must enter at `from`. */
  branches: Array<{
    id: string;
    from: string;
    to: string;
    polar?: boolean;
    role?: BranchRole;
    code?: string;
    share?: { param: string; invert?: boolean };
  }>;
  modes?: Array<{ whenWired: string[]; branches: string[] }>;
  /** Key of the number field that holds the primary value. */
  valueField?: string;
  fields: ConfigField[];
}

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
  /** Numeric settings other than the value, e.g. wiperPosition (0-1). */
  params?: Record<string, number>;
  /** How the component behaves. Defaults to the built-in preset of `kind`. */
  spec?: ComponentSpec;
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
