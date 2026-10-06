import type {
  AllowedTopology,
  CheckKey,
  CircuitRules,
  ExtraComponentsPolicy,
} from './types';

export const ALLOWED_TOPOLOGIES: AllowedTopology[] = [
  'series',
  'parallel',
  'series-parallel',
  'any',
];

const EXTRA_COMPONENT_POLICIES: ExtraComponentsPolicy[] = [
  'allow',
  'warn',
  'fail',
];

export const DEFAULT_CHECK_WEIGHTS: Record<CheckKey, number> = {
  requiredComponents: 25,
  extraComponents: 5,
  connections: 20,
  shortCircuit: 10,
  circuitComplete: 15,
  circuitClosed: 10,
  topology: 20,
  equivalentResistance: 10,
  steps: 10,
  matchesReference: 30,
  polarity: 10,
  instruments: 10,
};

export const DEFAULT_CIRCUIT_RULES: CircuitRules = {
  allowedTopologies: ['any'],
  requireClosedCircuit: true,
  requireAllConnected: true,
  forbidShortCircuit: true,
  extraComponents: 'warn',
  checkComponentValues: true,
  valueTolerancePercent: 5,
  equivalentResistance: null,
  requireStepsCompleted: true,
  compareToReference: true,
};

export class InvalidCircuitRulesError extends Error {}

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const optionalBoolean = (value: unknown, fallback: boolean, field: string) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new InvalidCircuitRulesError(`${field} must be a boolean`);
  }
  return value;
};

const optionalNumber = (value: unknown, field: string): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidCircuitRulesError(
      `${field} must be a non-negative number`,
    );
  }
  return parsed;
};

/**
 * Validate instructor input and fill in defaults. Throws
 * InvalidCircuitRulesError for invalid values; unknown keys are dropped.
 */
export const normalizeCircuitRules = (input: unknown): CircuitRules => {
  const raw = asRecord(input);
  if (!raw) throw new InvalidCircuitRulesError('Rules must be an object');

  let allowedTopologies = DEFAULT_CIRCUIT_RULES.allowedTopologies;
  if (raw.allowedTopologies !== undefined) {
    if (
      !Array.isArray(raw.allowedTopologies) ||
      raw.allowedTopologies.length === 0 ||
      raw.allowedTopologies.some(
        (t) => !ALLOWED_TOPOLOGIES.includes(t as AllowedTopology),
      )
    ) {
      throw new InvalidCircuitRulesError(
        `allowedTopologies must be a non-empty list of: ${ALLOWED_TOPOLOGIES.join(', ')}`,
      );
    }
    allowedTopologies = [
      ...new Set(raw.allowedTopologies as AllowedTopology[]),
    ];
  }

  const extraComponents = (raw.extraComponents ??
    DEFAULT_CIRCUIT_RULES.extraComponents) as ExtraComponentsPolicy;
  if (!EXTRA_COMPONENT_POLICIES.includes(extraComponents)) {
    throw new InvalidCircuitRulesError(
      `extraComponents must be one of: ${EXTRA_COMPONENT_POLICIES.join(', ')}`,
    );
  }

  const resistance = asRecord(raw.equivalentResistance);
  const min = optionalNumber(resistance?.min, 'equivalentResistance.min');
  const max = optionalNumber(resistance?.max, 'equivalentResistance.max');
  if (min !== null && max !== null && min > max) {
    throw new InvalidCircuitRulesError(
      'equivalentResistance.min must not be greater than max',
    );
  }

  const weightsInput = asRecord(raw.weights);
  let weights: CircuitRules['weights'];
  if (weightsInput) {
    weights = {};
    for (const key of Object.keys(DEFAULT_CHECK_WEIGHTS) as CheckKey[]) {
      const weight = optionalNumber(weightsInput[key], `weights.${key}`);
      if (weight !== null) weights[key] = weight;
    }
  }

  return {
    allowedTopologies,
    requireClosedCircuit: optionalBoolean(
      raw.requireClosedCircuit,
      DEFAULT_CIRCUIT_RULES.requireClosedCircuit,
      'requireClosedCircuit',
    ),
    requireAllConnected: optionalBoolean(
      raw.requireAllConnected,
      DEFAULT_CIRCUIT_RULES.requireAllConnected,
      'requireAllConnected',
    ),
    forbidShortCircuit: optionalBoolean(
      raw.forbidShortCircuit,
      DEFAULT_CIRCUIT_RULES.forbidShortCircuit,
      'forbidShortCircuit',
    ),
    extraComponents,
    checkComponentValues: optionalBoolean(
      raw.checkComponentValues,
      DEFAULT_CIRCUIT_RULES.checkComponentValues,
      'checkComponentValues',
    ),
    valueTolerancePercent:
      optionalNumber(raw.valueTolerancePercent, 'valueTolerancePercent') ??
      DEFAULT_CIRCUIT_RULES.valueTolerancePercent,
    equivalentResistance: min === null && max === null ? null : { min, max },
    requireStepsCompleted: optionalBoolean(
      raw.requireStepsCompleted,
      DEFAULT_CIRCUIT_RULES.requireStepsCompleted,
      'requireStepsCompleted',
    ),
    compareToReference: optionalBoolean(
      raw.compareToReference,
      DEFAULT_CIRCUIT_RULES.compareToReference,
      'compareToReference',
    ),
    ...(weights && { weights }),
  };
};

/** Read stored rules. Returns null (use the defaults) for missing/invalid data. */
export const readStoredCircuitRules = (
  stored: unknown,
): CircuitRules | null => {
  if (stored === null || stored === undefined) return null;
  try {
    return normalizeCircuitRules(stored);
  } catch {
    return null;
  }
};
