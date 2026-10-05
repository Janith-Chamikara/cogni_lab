import type { CheckResult, StepProgress, ValidationResult } from './types';

// Grading for labs without circuit rules (circuitRulesJson = null).
// This reproduces the checks the student editor ran on the client before
// rule-based validation existed, so existing labs grade exactly as before.

export interface LegacyValidationInput {
  /** equipmentId of each placement the instructor added. */
  expectedEquipmentIds: string[];
  /** Names used in "missing equipment" messages, keyed by equipmentId. */
  equipmentNames: Record<string, string>;
  expectedConnectionCount: number;
  /** equipmentId of each component the student placed. */
  placedEquipmentIds: string[];
  connectionCount: number;
  steps: StepProgress;
}

export const validateLegacyCircuit = (
  input: LegacyValidationInput,
): ValidationResult => {
  const checks: Record<string, CheckResult> = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const add = (
    key: string,
    label: string,
    passed: boolean,
    message: string,
  ) => {
    checks[key] = { passed, label, message, weight: 1 };
    if (!passed) errors.push(message);
  };

  const placed = input.placedEquipmentIds.length;
  const expected = input.expectedEquipmentIds.length;
  add(
    'equipmentCount',
    'Equipment placed',
    placed >= expected,
    placed >= expected
      ? `You have placed ${placed} equipment items`
      : `Missing equipment: You have ${placed}/${expected} items`,
  );

  const missingIds = [...new Set(input.expectedEquipmentIds)].filter(
    (id) => !input.placedEquipmentIds.includes(id),
  );
  add(
    'equipmentTypes',
    'Required equipment',
    missingIds.length === 0,
    missingIds.length === 0
      ? 'All required equipment types are present'
      : `Missing equipment: ${missingIds
          .map((id) => input.equipmentNames[id])
          .filter(Boolean)
          .join(', ')}`,
  );

  if (input.expectedConnectionCount > 0) {
    const ok = input.connectionCount >= input.expectedConnectionCount;
    add(
      'connections',
      'Connections',
      ok,
      ok
        ? `You have ${input.connectionCount} connections`
        : `Missing connections: You have ${input.connectionCount}/${input.expectedConnectionCount} connections`,
    );
  } else if (input.connectionCount > 0) {
    add(
      'connections',
      'Connections',
      true,
      `You have created ${input.connectionCount} connections`,
    );
  } else {
    // Matches the old behaviour: no point awarded, shown as information.
    checks.connections = {
      passed: false,
      label: 'Connections',
      message: 'No connections created yet',
      weight: 1,
    };
    warnings.push('No connections created yet');
  }

  const { completed, total } = input.steps;
  add(
    'steps',
    'Steps completed',
    completed === total,
    completed === total
      ? 'All steps completed'
      : `Complete all steps: ${completed}/${total} done`,
  );

  const all = Object.values(checks);
  const passedCount = all.filter((c) => c.passed).length;

  return {
    mode: 'legacy',
    passed: passedCount === all.length,
    score: Math.round((passedCount / all.length) * 100),
    checks,
    errors,
    warnings,
    summary: {
      topology: null,
      equivalentResistance: null,
      componentCount: placed,
      connectionCount: input.connectionCount,
    },
  };
};
