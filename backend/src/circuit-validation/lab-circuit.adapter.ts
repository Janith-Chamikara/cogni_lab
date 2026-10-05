import {
  getComponentSpec,
  resolveComponentKind,
  resolveComponentValue,
} from './component-registry';
import { asRecord } from './circuit-rules';
import type { CircuitComponent, CircuitState } from './types';

// Converts the project's existing data shapes (LabInstanceEquipment
// placements, WireConnection-style wires) into validation engine inputs.

export interface LabPlacementLike {
  id: string;
  equipmentId: string;
  configJson?: unknown;
  equipment?: {
    equipmentName: string;
    equipmentType: string;
    defaultConfigJson?: unknown;
  } | null;
}

/** Student circuit as sent by the student editor. */
export interface StudentCircuitInput {
  components: Array<{
    id: string;
    equipmentId: string;
    /** The instructor placement this component was taken from. */
    labEquipmentId?: string | null;
  }>;
  connections: Array<{
    sourceEquipmentId: string;
    targetEquipmentId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
}

const describePlacement = (placement: LabPlacementLike) => {
  const config = asRecord(placement.configJson);
  const defaults = asRecord(placement.equipment?.defaultConfigJson);
  const kind = resolveComponentKind(
    placement.equipment?.equipmentName,
    placement.equipment?.equipmentType,
    config ?? defaults,
  );
  return {
    kind,
    value: resolveComponentValue(kind, config, defaults),
    name:
      typeof config?.name === 'string' && config.name.trim()
        ? config.name.trim()
        : null,
  };
};

/**
 * Required components of a lab, one per instructor placement. Labels come
 * from the placement's configured name, otherwise R1, R2, C1, V1, ...
 */
export const buildRequiredComponents = (
  placements: LabPlacementLike[],
): CircuitComponent[] => {
  const counters = new Map<string, number>();
  return placements.map((placement) => {
    const { kind, value, name } = describePlacement(placement);
    const prefix = getComponentSpec(kind).labelPrefix;
    const count = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, count);
    return {
      id: placement.id,
      label: name ?? `${prefix}${count}`,
      kind,
      value,
    };
  });
};

/**
 * Build the student's circuit. Kind, value and label are taken from the lab's
 * placements on the server, so students cannot alter component values.
 */
export const buildStudentCircuit = (
  placements: LabPlacementLike[],
  student: StudentCircuitInput,
): CircuitState => {
  const required = buildRequiredComponents(placements);
  const requiredById = new Map(required.map((r) => [r.id, r]));
  const usedLabels = new Map<string, number>();

  const components: CircuitComponent[] = student.components.map((c) => {
    const placement =
      placements.find((p) => p.id === c.labEquipmentId) ??
      placements.find((p) => p.equipmentId === c.equipmentId);
    const source = placement ? requiredById.get(placement.id) : undefined;

    const baseLabel = source?.label ?? 'Unknown component';
    const seen = (usedLabels.get(baseLabel) ?? 0) + 1;
    usedLabels.set(baseLabel, seen);

    return {
      id: c.id,
      label: seen > 1 ? `${baseLabel} (${seen})` : baseLabel,
      kind: source?.kind ?? 'unknown',
      value: source?.value ?? null,
    };
  });

  return {
    components,
    wires: student.connections.map((conn) => ({
      from: {
        componentId: conn.sourceEquipmentId,
        handle: conn.sourceHandle ?? 'right',
      },
      to: {
        componentId: conn.targetEquipmentId,
        handle: conn.targetHandle ?? 'left',
      },
    })),
  };
};
