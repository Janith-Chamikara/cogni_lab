import {
  compileDefinition,
  readStoredDefinition,
} from './component-definition';
import { guessPreset, presetForKind, getPreset } from './component-presets';
import type {
  CircuitComponent,
  ComponentDefinition,
  ComponentKind,
  ComponentSpec,
  TerminalSpec,
} from './types';

// Resolves how a component behaves. Each equipment carries its own
// definition (LabEquipment.componentSpecJson); equipment without one uses
// the preset its name suggests (component-presets.ts).

const compiledPresets = new Map<string, ComponentSpec>();

/** Built-in behaviour of a kind (used when a component has no own spec). */
export const getComponentSpec = (kind: ComponentKind): ComponentSpec => {
  const preset = presetForKind(kind) ?? getPreset('generic')!;
  let spec = compiledPresets.get(preset.id);
  if (!spec) {
    spec = compileDefinition(preset.definition);
    compiledPresets.set(preset.id, spec);
  }
  return spec;
};

/** The spec of a component: its own, or the built-in one of its kind. */
export const specOf = (component: CircuitComponent): ComponentSpec =>
  component.spec ?? getComponentSpec(component.kind);

export interface EquipmentLike {
  equipmentName: string;
  equipmentType: string;
  defaultConfigJson?: unknown;
  componentSpecJson?: unknown;
}

/**
 * The definition of an equipment: the one its creator saved, otherwise the
 * preset guessed from its config, name and type.
 */
export const resolveEquipmentDefinition = (
  equipment: EquipmentLike,
  config?: Record<string, unknown> | null,
): ComponentDefinition =>
  readStoredDefinition(equipment.componentSpecJson) ??
  guessPreset(equipment.equipmentName, equipment.equipmentType, config)
    .definition;

// Wires saved before named terminals: left/top are the first terminal,
// right/bottom the second.
const LEGACY_HANDLE_INDEX: Record<string, number> = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
};

/**
 * Map a canvas handle id to a terminal index. Named terminal ids match
 * first; legacy positional handles (left/right/top/bottom) still work.
 */
export const handleToTerminalIndex = (
  terminals: TerminalSpec[],
  handle?: string | null,
): number | null => {
  const named = terminals.findIndex((t) => t.id === handle);
  if (named >= 0) return named;
  return LEGACY_HANDLE_INDEX[handle ?? ''] ?? null;
};

/** Parse numbers stored as numbers or strings like "50V" / "1.5". */
export const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

type Config = Record<string, unknown> | null | undefined;

const own = (config: Config, key: string) =>
  config && Object.prototype.hasOwnProperty.call(config, key)
    ? config[key]
    : undefined;

/** First number found for a field: in the configs, then its default. */
const readNumber = (spec: ComponentSpec, key: string, configs: Config[]) => {
  for (const config of configs) {
    const value = parseNumeric(own(config, key));
    if (value !== null) return value;
  }
  return parseNumeric(spec.fields.find((f) => f.key === key)?.default);
};

/** The component's primary value (e.g. resistance), if it has one. */
export const resolveComponentValue = (
  spec: ComponentSpec,
  ...configs: Config[]
): number | null =>
  spec.valueKey ? readNumber(spec, spec.valueKey, configs) : null;

/** Other number settings, kept within each field's min/max. */
export const resolveComponentParams = (
  spec: ComponentSpec,
  ...configs: Config[]
): Record<string, number> | undefined => {
  const params: Record<string, number> = {};
  for (const field of spec.fields) {
    if (field.type !== 'number' || field.key === spec.valueKey) continue;
    const value = readNumber(spec, field.key, configs);
    if (value === null) continue;
    params[field.key] = Math.min(
      field.max ?? Infinity,
      Math.max(field.min ?? -Infinity, value),
    );
  }
  return Object.keys(params).length > 0 ? params : undefined;
};

export const formatValue = (
  component: CircuitComponent,
  value?: number | null,
) => {
  const unit = specOf(component).unit;
  return value === null || value === undefined || !unit
    ? ''
    : `${value} ${unit}`;
};
