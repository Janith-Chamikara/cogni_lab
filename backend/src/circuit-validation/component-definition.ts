import type {
  BranchRole,
  ComponentDefinition,
  ComponentRole,
  ComponentSpec,
  ConfigField,
  ConfigFieldType,
  TerminalSide,
  TerminalSpec,
} from './types';

// Equipment creators describe a component as a ComponentDefinition: its
// terminals, the branches current can take between them, and the settings
// shown when it is configured in a lab. This file checks a definition
// (creator input) and compiles it into the ComponentSpec the engine uses.

export class InvalidComponentDefinitionError extends Error {}

const LIMITS = {
  terminals: 8,
  branches: 12,
  modes: 16,
  fields: 12,
  options: 20,
  text: 40,
};

const ROLES: ComponentRole[] = ['load', 'source', 'instrument'];
const BRANCH_ROLES: BranchRole[] = ['load', 'voltmeter', 'ammeter'];
const SIDES: TerminalSide[] = ['left', 'right', 'top', 'bottom'];
const FIELD_TYPES: ConfigFieldType[] = ['number', 'text', 'select'];

const ID = /^[A-Za-z0-9_-]{1,20}$/;
const KIND = /^[a-z][a-z0-9_]{0,29}$/;
// Codes appear inside fingerprints such as S(R:100,LED>), so they must not
// contain the characters that structure them.
const CODE = /^[A-Za-z][A-Za-z0-9_]{0,7}$/;
const FIELD_KEY = /^[A-Za-z][A-Za-z0-9_]{0,29}$/;
/** Config keys with a fixed meaning that fields cannot redefine. */
const RESERVED_KEYS = new Set(['name', 'componentKind', 'terminals']);

const fail = (message: string): never => {
  throw new InvalidComponentDefinitionError(message);
};

const record = (value: unknown, field: string) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail(`${field} must be an object`);

const list = (value: unknown, field: string, max: number, min = 0) => {
  if (!Array.isArray(value)) return fail(`${field} must be a list`);
  if (value.length < min || value.length > max) {
    fail(`${field} must have ${min}–${max} entries`);
  }
  return value as unknown[];
};

const text = (value: unknown, field: string, fallback?: string) => {
  if ((value === undefined || value === null || value === '') && fallback) {
    return fallback;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return fail(`${field} must be a non-empty text`);
  }
  return value.trim().slice(0, LIMITS.text);
};

const optionalText = (value: unknown, field: string) =>
  value === undefined || value === null || value === ''
    ? undefined
    : text(value, field);

const matching = (value: unknown, pattern: RegExp, field: string) =>
  typeof value === 'string' && pattern.test(value)
    ? value
    : fail(`${field} "${String(value)}" is not a valid id`);

const oneOf = <T extends string>(
  value: unknown,
  allowed: T[],
  field: string,
  fallback?: T,
): T => {
  if ((value === undefined || value === null) && fallback) return fallback;
  return allowed.includes(value as T)
    ? (value as T)
    : fail(`${field} must be one of: ${allowed.join(', ')}`);
};

const flag = (value: unknown, field: string) => {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'boolean'
    ? value
    : fail(`${field} must be true or false`);
};

const optionalNumber = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(`${field} must be a number`);
};

const unique = (ids: string[], field: string) => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) fail(`${field} "${id}" is used more than once`);
    seen.add(id);
  }
};

const normalizeTerminals = (value: unknown): TerminalSpec[] => {
  const terminals = list(value, 'terminals', LIMITS.terminals, 2).map(
    (item, index) => {
      const raw = record(item, `terminals[${index}]`);
      const id = matching(raw.id, ID, 'Terminal id');
      const label = text(raw.label, `Terminal ${id} label`, id);
      return {
        id,
        label,
        name: text(raw.name, `Terminal ${id} name`, `terminal ${label}`),
        side: oneOf(raw.side, SIDES, `Terminal ${id} side`, 'left'),
      };
    },
  );
  unique(
    terminals.map((t) => t.id),
    'Terminal id',
  );
  return terminals;
};

const normalizeFields = (value: unknown): ConfigField[] => {
  if (value === undefined || value === null) return [];
  const fields = list(value, 'fields', LIMITS.fields).map((item, index) => {
    const raw = record(item, `fields[${index}]`);
    const key = matching(raw.key, FIELD_KEY, 'Field key');
    if (RESERVED_KEYS.has(key)) fail(`Field key "${key}" is reserved`);
    const type = oneOf(raw.type, FIELD_TYPES, `Field ${key} type`, 'number');
    const field: ConfigField = {
      key,
      label: text(raw.label, `Field ${key} label`, key),
      type,
    };

    const unit = optionalText(raw.unit, `Field ${key} unit`);
    if (unit) field.unit = unit;

    if (type === 'select') {
      field.options = list(
        raw.options,
        `Field ${key} options`,
        LIMITS.options,
        1,
      ).map((option) => text(option, `Field ${key} option`));
      unique(field.options, `Field ${key} option`);
    }

    if (type === 'number') {
      const min = optionalNumber(raw.min, `Field ${key} min`);
      const max = optionalNumber(raw.max, `Field ${key} max`);
      if (min !== undefined && max !== undefined && min > max) {
        fail(`Field ${key}: min must not be greater than max`);
      }
      if (min !== undefined) field.min = min;
      if (max !== undefined) field.max = max;
    }

    if (
      raw.default !== undefined &&
      raw.default !== null &&
      raw.default !== ''
    ) {
      if (type === 'number') {
        const value = optionalNumber(raw.default, `Field ${key} default`)!;
        if (
          (field.min !== undefined && value < field.min) ||
          (field.max !== undefined && value > field.max)
        ) {
          fail(`Field ${key}: default is outside min/max`);
        }
        field.default = value;
      } else {
        const value = text(raw.default, `Field ${key} default`);
        if (type === 'select' && !field.options!.includes(value)) {
          fail(`Field ${key}: default must be one of its options`);
        }
        field.default = value;
      }
    }
    return field;
  });
  unique(
    fields.map((f) => f.key),
    'Field key',
  );
  return fields;
};

/**
 * Check a creator's component definition and fill in defaults. Throws
 * InvalidComponentDefinitionError with a message for the creator; unknown
 * keys are dropped.
 */
export const normalizeComponentDefinition = (
  input: unknown,
): ComponentDefinition => {
  const raw = record(input, 'Component definition');
  const kind = matching(raw.kind, KIND, 'Component kind');
  const labelPrefix = matching(raw.labelPrefix, CODE, 'Label prefix');
  const code = raw.code
    ? matching(raw.code, CODE, 'Fingerprint code')
    : undefined;
  const role = oneOf(raw.role, ROLES, 'Role', 'load');
  const terminals = normalizeTerminals(raw.terminals);
  const terminalIds = new Set(terminals.map((t) => t.id));
  const fields = normalizeFields(raw.fields);
  const numberFields = new Set(
    fields.filter((f) => f.type === 'number').map((f) => f.key),
  );

  const terminalRef = (value: unknown, field: string) => {
    const id = matching(value, ID, field);
    return terminalIds.has(id)
      ? id
      : fail(`${field} "${id}" is not a terminal`);
  };

  const branches = list(raw.branches, 'branches', LIMITS.branches, 1).map(
    (item, index) => {
      const entry = record(item, `branches[${index}]`);
      const id = matching(entry.id, ID, 'Branch id');
      const from = terminalRef(entry.from, `Branch ${id} from`);
      const to = terminalRef(entry.to, `Branch ${id} to`);
      if (from === to)
        fail(`Branch ${id} must connect two different terminals`);

      const branchRole = oneOf(
        entry.role,
        BRANCH_ROLES,
        `Branch ${id} role`,
        role === 'instrument' ? 'voltmeter' : 'load',
      );
      if (role !== 'instrument' && branchRole !== 'load') {
        fail(`Branch ${id}: only instruments can measure (voltmeter/ammeter)`);
      }

      const branch: ComponentDefinition['branches'][number] = { id, from, to };
      if (flag(entry.polar, `Branch ${id} polar`)) branch.polar = true;
      if (branchRole !== 'load') branch.role = branchRole;
      if (entry.code)
        branch.code = matching(entry.code, CODE, `Branch ${id} code`);
      if (entry.share !== undefined && entry.share !== null) {
        const share = record(entry.share, `Branch ${id} share`);
        const param = matching(
          share.param,
          FIELD_KEY,
          `Branch ${id} share param`,
        );
        if (!numberFields.has(param)) {
          fail(`Branch ${id} share must use a number field`);
        }
        branch.share = { param };
        if (flag(share.invert, `Branch ${id} share invert`)) {
          branch.share.invert = true;
        }
      }
      return branch;
    },
  );
  unique(
    branches.map((b) => b.id),
    'Branch id',
  );
  const branchIds = new Set(branches.map((b) => b.id));

  let modes: ComponentDefinition['modes'];
  if (raw.modes !== undefined && raw.modes !== null) {
    modes = list(raw.modes, 'modes', LIMITS.modes).map((item, index) => {
      const entry = record(item, `modes[${index}]`);
      const whenWired = list(
        entry.whenWired ?? [],
        `modes[${index}].whenWired`,
        LIMITS.terminals,
      ).map((id) => terminalRef(id, `Mode ${index + 1} terminal`));
      const used = list(
        entry.branches,
        `modes[${index}].branches`,
        LIMITS.branches,
        1,
      ).map((id) => {
        const branchId = matching(id, ID, `Mode ${index + 1} branch`);
        return branchIds.has(branchId)
          ? branchId
          : fail(`Mode ${index + 1} branch "${branchId}" does not exist`);
      });
      return {
        whenWired: [...new Set(whenWired)],
        branches: [...new Set(used)],
      };
    });
    if (modes.length === 0) modes = undefined;
  }

  const definition: ComponentDefinition = {
    kind,
    labelPrefix,
    role,
    terminals,
    branches,
    fields,
  };
  if (code) definition.code = code;
  if (modes) definition.modes = modes;
  if (flag(raw.resistive, 'Resistive')) definition.resistive = true;

  if (
    raw.valueField !== undefined &&
    raw.valueField !== null &&
    raw.valueField !== ''
  ) {
    const key = matching(raw.valueField, FIELD_KEY, 'Value field');
    if (!numberFields.has(key)) fail('Value field must be a number field');
    definition.valueField = key;
  }
  if (definition.resistive && !definition.valueField) {
    fail('A resistive component needs a value field (its resistance)');
  }

  if (role === 'source') {
    if (branches.length !== 1) fail('A source must have exactly one branch');
    const plus = terminalRef(raw.positiveTerminal, 'Positive terminal');
    if (plus !== branches[0].from && plus !== branches[0].to) {
      fail('The positive terminal must be an end of the source branch');
    }
    definition.positiveTerminal = plus;
  }

  return definition;
};

/** Read a stored definition. Returns null for missing or invalid data. */
export const readStoredDefinition = (
  stored: unknown,
): ComponentDefinition | null => {
  if (stored === null || stored === undefined) return null;
  try {
    return normalizeComponentDefinition(
      typeof stored === 'string' ? JSON.parse(stored) : stored,
    );
  } catch {
    return null;
  }
};

/** Turn a (valid) definition into the index-based spec the engine uses. */
export const compileDefinition = (
  definition: ComponentDefinition,
): ComponentSpec => {
  const index = (id: string) =>
    definition.terminals.findIndex((t) => t.id === id);
  const valueField = definition.fields.find(
    (f) => f.key === definition.valueField,
  );

  return {
    kind: definition.kind,
    labelPrefix: definition.labelPrefix,
    code: definition.code ?? definition.labelPrefix,
    terminals: definition.terminals,
    branches: definition.branches.map((b) => ({
      id: b.id,
      between: [index(b.from), index(b.to)],
      ...(b.polar && { polar: true }),
      ...(b.role && { role: b.role }),
      ...(b.code && { code: b.code }),
      ...(b.share && { share: b.share }),
    })),
    ...(definition.modes && {
      modes: definition.modes.map((m) => ({
        whenWired: m.whenWired.map(index),
        branches: m.branches,
      })),
    }),
    ...(valueField && { valueKey: valueField.key }),
    ...(valueField?.unit && { unit: valueField.unit }),
    ...(definition.role === 'source' && {
      isSource: true,
      plusTerminal: index(definition.positiveTerminal!),
    }),
    ...(definition.role === 'instrument' && { isInstrument: true }),
    ...(definition.resistive && { resistive: true }),
    fields: definition.fields,
  };
};
