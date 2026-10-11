"use client";

import { Plus, Trash2 } from "lucide-react";

import type {
  BranchRole,
  ComponentDefinition,
  ComponentPreset,
  ConfigField,
  TerminalSpec,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Editor for a component definition: terminals, branches (paths current can
// take between terminals), settings fields and wiring modes. Rows refer to
// each other by an internal uid, so renaming a terminal, branch or field
// keeps every reference to it. The backend checks the result on save.

type Side = TerminalSpec["side"];
type Role = ComponentDefinition["role"];

type TerminalRow = TerminalSpec & { uid: string };
type BranchRow = {
  uid: string;
  id: string;
  /** Terminal uids ("" when unset). */
  from: string;
  to: string;
  polar: boolean;
  role: BranchRole;
  code: string;
  /** Field uid of the share param ("" for none). */
  shareParam: string;
  shareInvert: boolean;
};
/** Number and option values are kept as typed and converted on save. */
type FieldRow = {
  uid: string;
  key: string;
  label: string;
  type: ConfigField["type"];
  unit: string;
  options: string;
  min: string;
  max: string;
  default: string;
};
type ModeRow = { uid: string; whenWired: string[]; branches: string[] };

export type ComponentEditorState = {
  kind: string;
  labelPrefix: string;
  code: string;
  role: Role;
  resistive: boolean;
  /** Terminal uid. */
  positiveTerminal: string;
  /** Field uid. */
  valueField: string;
  terminals: TerminalRow[];
  branches: BranchRow[];
  fields: FieldRow[];
  modes: ModeRow[];
};

const NONE = "__none";
const SIDES: Side[] = ["left", "right", "top", "bottom"];
const ROLES: Array<{ value: Role; label: string }> = [
  { value: "load", label: "Load (part of the circuit)" },
  { value: "source", label: "Source (supply / generator)" },
  { value: "instrument", label: "Instrument (meter / probe)" },
];
const BRANCH_ROLES: Array<{ value: BranchRole; label: string }> = [
  { value: "voltmeter", label: "Measures voltage" },
  { value: "ammeter", label: "Measures current" },
  { value: "load", label: "Conducts" },
];

let uidCounter = 0;
const uid = () => `row-${++uidCounter}`;

const nextName = (prefix: string, taken: string[]) => {
  let i = taken.length + 1;
  while (taken.includes(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
};

const toNumber = (text: string) =>
  text.trim() === "" || !Number.isFinite(Number(text))
    ? undefined
    : Number(text);

export const fromDefinition = (
  definition: ComponentDefinition,
): ComponentEditorState => {
  const terminals = definition.terminals.map((t) => ({ ...t, uid: uid() }));
  const fields: FieldRow[] = definition.fields.map((f) => ({
    uid: uid(),
    key: f.key,
    label: f.label,
    type: f.type,
    unit: f.unit ?? "",
    options: f.options?.join(", ") ?? "",
    min: f.min?.toString() ?? "",
    max: f.max?.toString() ?? "",
    default: f.default?.toString() ?? "",
  }));
  const terminalUid = (id?: string) =>
    terminals.find((t) => t.id === id)?.uid ?? "";
  const fieldUid = (key?: string) =>
    fields.find((f) => f.key === key)?.uid ?? "";
  const branches: BranchRow[] = definition.branches.map((b) => ({
    uid: uid(),
    id: b.id,
    from: terminalUid(b.from),
    to: terminalUid(b.to),
    polar: !!b.polar,
    role: b.role ?? (definition.role === "instrument" ? "voltmeter" : "load"),
    code: b.code ?? "",
    shareParam: fieldUid(b.share?.param),
    shareInvert: !!b.share?.invert,
  }));
  const branchUid = (id: string) =>
    branches.find((b) => b.id === id)?.uid ?? "";

  return {
    kind: definition.kind,
    labelPrefix: definition.labelPrefix,
    code: definition.code ?? "",
    role: definition.role,
    resistive: !!definition.resistive,
    positiveTerminal: terminalUid(definition.positiveTerminal),
    valueField: fieldUid(definition.valueField),
    terminals,
    branches,
    fields,
    modes: (definition.modes ?? []).map((m) => ({
      uid: uid(),
      whenWired: m.whenWired.map(terminalUid).filter(Boolean),
      branches: m.branches.map(branchUid).filter(Boolean),
    })),
  };
};

export const toDefinition = (
  state: ComponentEditorState,
): ComponentDefinition => {
  const terminalId = new Map(state.terminals.map((t) => [t.uid, t.id.trim()]));
  const fieldKey = new Map(state.fields.map((f) => [f.uid, f.key.trim()]));
  const branchId = new Map(state.branches.map((b) => [b.uid, b.id.trim()]));

  const fields: ConfigField[] = state.fields.map((f) => {
    const field: ConfigField = {
      key: f.key.trim(),
      label: f.label.trim(),
      type: f.type,
    };
    if (f.unit.trim()) field.unit = f.unit.trim();
    if (f.type === "select") {
      field.options = f.options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    }
    if (f.type === "number") {
      field.min = toNumber(f.min);
      field.max = toNumber(f.max);
      field.default = toNumber(f.default);
    } else if (f.default.trim()) {
      field.default = f.default.trim();
    }
    return field;
  });

  const definition: ComponentDefinition = {
    kind: state.kind.trim(),
    labelPrefix: state.labelPrefix.trim(),
    role: state.role,
    terminals: state.terminals.map(({ id, label, name, side }) => ({
      id: id.trim(),
      label: label.trim(),
      name: name.trim(),
      side,
    })),
    branches: state.branches.map((b) => ({
      id: b.id.trim(),
      from: terminalId.get(b.from) ?? "",
      to: terminalId.get(b.to) ?? "",
      ...(b.polar && { polar: true }),
      ...(state.role === "instrument" && { role: b.role }),
      ...(b.code.trim() && { code: b.code.trim() }),
      ...(b.shareParam && {
        share: {
          param: fieldKey.get(b.shareParam) ?? "",
          ...(b.shareInvert && { invert: true }),
        },
      }),
    })),
    fields,
  };
  if (state.code.trim()) definition.code = state.code.trim();
  if (state.resistive) definition.resistive = true;
  if (state.valueField) definition.valueField = fieldKey.get(state.valueField);
  if (state.role === "source" && state.positiveTerminal) {
    definition.positiveTerminal = terminalId.get(state.positiveTerminal);
  }
  if (state.modes.length > 0) {
    definition.modes = state.modes.map((m) => ({
      whenWired: m.whenWired.map((u) => terminalId.get(u) ?? ""),
      branches: m.branches.map((u) => branchId.get(u) ?? ""),
    }));
  }
  return definition;
};

const smallInput = "h-8 text-xs";

function Section({
  title,
  hint,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  hint?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium">{title}</h4>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {onAdd && (
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      onClick={onClick}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
  placeholder,
  className = "w-28",
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={`text-xs ${className}`}
      >
        <SelectValue placeholder={placeholder ?? label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type ComponentDefinitionEditorProps = {
  presets: ComponentPreset[];
  presetId: string;
  onPresetChange: (presetId: string) => void;
  value: ComponentEditorState;
  onChange: (value: ComponentEditorState) => void;
};

export function ComponentDefinitionEditor({
  presets,
  presetId,
  onPresetChange,
  value,
  onChange,
}: ComponentDefinitionEditorProps) {
  const set = (patch: Partial<ComponentEditorState>) =>
    onChange({ ...value, ...patch });

  const terminalOptions = value.terminals.map((t) => ({
    value: t.uid,
    label: t.label ? `${t.id} (${t.label})` : t.id,
  }));
  const numberFieldOptions = value.fields
    .filter((f) => f.type === "number")
    .map((f) => ({ value: f.uid, label: f.label || f.key }));
  const preset = presets.find((p) => p.id === presetId);

  // ---- Terminals ----------------------------------------------------------
  const updateTerminal = (row: string, patch: Partial<TerminalRow>) =>
    set({
      terminals: value.terminals.map((t) =>
        t.uid === row ? { ...t, ...patch } : t,
      ),
    });
  const addTerminal = () => {
    const id = nextName(
      "t",
      value.terminals.map((t) => t.id),
    );
    set({
      terminals: [
        ...value.terminals,
        { uid: uid(), id, label: id, name: `terminal ${id}`, side: "right" },
      ],
    });
  };
  const removeTerminal = (row: string) =>
    set({
      terminals: value.terminals.filter((t) => t.uid !== row),
      branches: value.branches.map((b) => ({
        ...b,
        from: b.from === row ? "" : b.from,
        to: b.to === row ? "" : b.to,
      })),
      modes: value.modes.map((m) => ({
        ...m,
        whenWired: m.whenWired.filter((u) => u !== row),
      })),
      positiveTerminal:
        value.positiveTerminal === row ? "" : value.positiveTerminal,
    });

  // ---- Branches -----------------------------------------------------------
  const updateBranch = (row: string, patch: Partial<BranchRow>) =>
    set({
      branches: value.branches.map((b) =>
        b.uid === row ? { ...b, ...patch } : b,
      ),
    });
  const addBranch = () =>
    set({
      branches: [
        ...value.branches,
        {
          uid: uid(),
          id: nextName(
            "b",
            value.branches.map((b) => b.id),
          ),
          from: value.terminals[0]?.uid ?? "",
          to: value.terminals[1]?.uid ?? "",
          polar: false,
          role: value.role === "instrument" ? "voltmeter" : "load",
          code: "",
          shareParam: "",
          shareInvert: false,
        },
      ],
    });
  const removeBranch = (row: string) =>
    set({
      branches: value.branches.filter((b) => b.uid !== row),
      modes: value.modes
        .map((m) => ({ ...m, branches: m.branches.filter((u) => u !== row) }))
        .filter((m) => m.branches.length > 0),
    });

  // ---- Fields -------------------------------------------------------------
  const updateField = (row: string, patch: Partial<FieldRow>) =>
    set({
      fields: value.fields.map((f) => (f.uid === row ? { ...f, ...patch } : f)),
      // A value field or share must stay a number field.
      ...(patch.type &&
        patch.type !== "number" && {
          valueField: value.valueField === row ? "" : value.valueField,
          branches: value.branches.map((b) =>
            b.shareParam === row ? { ...b, shareParam: "" } : b,
          ),
        }),
    });
  const addField = () =>
    set({
      fields: [
        ...value.fields,
        {
          uid: uid(),
          key: nextName(
            "setting",
            value.fields.map((f) => f.key),
          ),
          label: "",
          type: "number",
          unit: "",
          options: "",
          min: "",
          max: "",
          default: "",
        },
      ],
    });
  const removeField = (row: string) =>
    set({
      fields: value.fields.filter((f) => f.uid !== row),
      valueField: value.valueField === row ? "" : value.valueField,
      branches: value.branches.map((b) =>
        b.shareParam === row ? { ...b, shareParam: "" } : b,
      ),
    });

  // ---- Modes --------------------------------------------------------------
  const toggle = (list: string[], item: string, on: boolean) =>
    on ? [...new Set([...list, item])] : list.filter((u) => u !== item);
  const updateMode = (row: string, patch: Partial<ModeRow>) =>
    set({
      modes: value.modes.map((m) => (m.uid === row ? { ...m, ...patch } : m)),
    });

  return (
    <div className="space-y-5 rounded-xl border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Circuit behaviour</h3>
        <p className="text-xs text-muted-foreground">
          How this equipment connects in a circuit and how it is graded. Start
          from a preset and change anything you need.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Start from</Label>
        <Choice
          label="Preset"
          value={presetId}
          onChange={onPresetChange}
          className="w-full sm:w-80"
          options={presets.map((p) => ({ value: p.id, label: p.name }))}
        />
        {preset && (
          <p className="text-xs text-muted-foreground">{preset.description}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="component-kind">Kind id</Label>
          <Input
            id="component-kind"
            className={smallInput}
            value={value.kind}
            placeholder="resistor"
            onChange={(e) => set({ kind: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="component-prefix">Label prefix</Label>
          <Input
            id="component-prefix"
            className={smallInput}
            value={value.labelPrefix}
            placeholder="R"
            onChange={(e) => set({ labelPrefix: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Role</Label>
          <Choice
            label="Role"
            value={value.role}
            className="w-full"
            options={ROLES}
            onChange={(role) =>
              set({
                role: role as Role,
                branches: value.branches.map((b) => ({
                  ...b,
                  role: role === "instrument" ? "voltmeter" : "load",
                })),
              })
            }
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Parts are matched to a lab&apos;s requirements by kind id, and named
        with the prefix (R1, R2, …).
      </p>

      <Section
        title="Terminals"
        hint="Connection points drawn on the canvas. Wires attach to the id."
        onAdd={addTerminal}
        addLabel="Terminal"
      >
        {value.terminals.map((t) => (
          <div key={t.uid} className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Terminal id"
              placeholder="id"
              className={`${smallInput} w-24`}
              value={t.id}
              onChange={(e) => updateTerminal(t.uid, { id: e.target.value })}
            />
            <Input
              aria-label="Terminal label"
              placeholder="label (+)"
              className={`${smallInput} w-20`}
              value={t.label}
              onChange={(e) => updateTerminal(t.uid, { label: e.target.value })}
            />
            <Input
              aria-label="Terminal name"
              placeholder="name used in feedback"
              className={`${smallInput} min-w-40 flex-1`}
              value={t.name}
              onChange={(e) => updateTerminal(t.uid, { name: e.target.value })}
            />
            <Choice
              label="Side"
              value={t.side}
              className="w-24"
              options={SIDES.map((s) => ({ value: s, label: s }))}
              onChange={(side) => updateTerminal(t.uid, { side: side as Side })}
            />
            <RemoveButton
              label={`Remove terminal ${t.id}`}
              onClick={() => removeTerminal(t.uid)}
            />
          </div>
        ))}
      </Section>

      <Section
        title="Branches"
        hint="Paths current can take between two terminals. For polar branches current must enter at “from”."
        onAdd={addBranch}
        addLabel="Branch"
      >
        {value.branches.map((b) => (
          <div
            key={b.uid}
            className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2"
          >
            <Input
              aria-label="Branch id"
              placeholder="id"
              className={`${smallInput} w-20`}
              value={b.id}
              onChange={(e) => updateBranch(b.uid, { id: e.target.value })}
            />
            <Choice
              label="From terminal"
              placeholder="from"
              value={b.from}
              options={terminalOptions}
              onChange={(from) => updateBranch(b.uid, { from })}
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Choice
              label="To terminal"
              placeholder="to"
              value={b.to}
              options={terminalOptions}
              onChange={(to) => updateBranch(b.uid, { to })}
            />
            <Check
              label="Polar"
              checked={b.polar}
              onChange={(polar) => updateBranch(b.uid, { polar })}
            />
            {value.role === "instrument" && (
              <Choice
                label="Measures"
                value={b.role}
                className="w-36"
                options={BRANCH_ROLES}
                onChange={(role) =>
                  updateBranch(b.uid, { role: role as BranchRole })
                }
              />
            )}
            {numberFieldOptions.length > 0 && (
              <>
                <Choice
                  label="Share of value"
                  value={b.shareParam || NONE}
                  className="w-36"
                  options={[
                    { value: NONE, label: "Full value" },
                    ...numberFieldOptions.map((o) => ({
                      ...o,
                      label: `Share: ${o.label}`,
                    })),
                  ]}
                  onChange={(param) =>
                    updateBranch(b.uid, {
                      shareParam: param === NONE ? "" : param,
                    })
                  }
                />
                {b.shareParam && (
                  <Check
                    label="1 − share"
                    checked={b.shareInvert}
                    onChange={(shareInvert) =>
                      updateBranch(b.uid, { shareInvert })
                    }
                  />
                )}
              </>
            )}
            <RemoveButton
              label={`Remove branch ${b.id}`}
              onClick={() => removeBranch(b.uid)}
            />
          </div>
        ))}
      </Section>

      {value.role === "source" && (
        <div className="space-y-1.5">
          <Label>Positive terminal</Label>
          <Choice
            label="Positive terminal"
            value={value.positiveTerminal}
            options={terminalOptions}
            className="w-48"
            onChange={(positiveTerminal) => set({ positiveTerminal })}
          />
        </div>
      )}

      <Section
        title="Settings"
        hint="Fields an instructor fills in when placing this equipment in a lab."
        onAdd={addField}
        addLabel="Setting"
      >
        {value.fields.map((f) => (
          <div
            key={f.uid}
            className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2"
          >
            <Input
              aria-label="Setting key"
              placeholder="key"
              className={`${smallInput} w-28`}
              value={f.key}
              onChange={(e) => updateField(f.uid, { key: e.target.value })}
            />
            <Input
              aria-label="Setting label"
              placeholder="label"
              className={`${smallInput} w-32`}
              value={f.label}
              onChange={(e) => updateField(f.uid, { label: e.target.value })}
            />
            <Choice
              label="Type"
              value={f.type}
              className="w-24"
              options={[
                { value: "number", label: "Number" },
                { value: "text", label: "Text" },
                { value: "select", label: "Choice" },
              ]}
              onChange={(type) =>
                updateField(f.uid, { type: type as FieldRow["type"] })
              }
            />
            <Input
              aria-label="Unit"
              placeholder="unit"
              className={`${smallInput} w-16`}
              value={f.unit}
              onChange={(e) => updateField(f.uid, { unit: e.target.value })}
            />
            {f.type === "number" && (
              <>
                <Input
                  aria-label="Minimum"
                  placeholder="min"
                  inputMode="decimal"
                  className={`${smallInput} w-16`}
                  value={f.min}
                  onChange={(e) => updateField(f.uid, { min: e.target.value })}
                />
                <Input
                  aria-label="Maximum"
                  placeholder="max"
                  inputMode="decimal"
                  className={`${smallInput} w-16`}
                  value={f.max}
                  onChange={(e) => updateField(f.uid, { max: e.target.value })}
                />
              </>
            )}
            {f.type === "select" && (
              <Input
                aria-label="Options"
                placeholder="options, comma separated"
                className={`${smallInput} min-w-40 flex-1`}
                value={f.options}
                onChange={(e) =>
                  updateField(f.uid, { options: e.target.value })
                }
              />
            )}
            <Input
              aria-label="Default"
              placeholder="default"
              inputMode={f.type === "number" ? "decimal" : undefined}
              className={`${smallInput} w-20`}
              value={f.default}
              onChange={(e) => updateField(f.uid, { default: e.target.value })}
            />
            <RemoveButton
              label={`Remove setting ${f.key}`}
              onClick={() => removeField(f.uid)}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Graded value</Label>
            <Choice
              label="Graded value"
              value={value.valueField || NONE}
              className="w-40"
              options={[{ value: NONE, label: "None" }, ...numberFieldOptions]}
              onChange={(field) =>
                set({ valueField: field === NONE ? "" : field })
              }
            />
          </div>
          <Check
            label="Counts towards equivalent resistance"
            checked={value.resistive}
            onChange={(resistive) => set({ resistive })}
          />
        </div>
      </Section>

      <details className="space-y-3">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced
        </summary>

        <div className="mt-3 flex items-center gap-2">
          <Label htmlFor="component-code" className="text-xs">
            Fingerprint code
          </Label>
          <Input
            id="component-code"
            className={`${smallInput} w-24`}
            placeholder={value.labelPrefix || "R"}
            value={value.code}
            onChange={(e) => set({ code: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            Parts with the same code are interchangeable when circuits are
            compared. Defaults to the label prefix.
          </span>
        </div>

        <Section
          title="Wiring modes"
          hint="The first mode whose terminals are all wired picks the branches in use. Without modes (or no match), every branch is used."
          onAdd={() =>
            set({
              modes: [
                ...value.modes,
                { uid: uid(), whenWired: [], branches: [] },
              ],
            })
          }
          addLabel="Mode"
        >
          {value.modes.map((m, index) => (
            <div
              key={m.uid}
              className="flex flex-wrap items-start gap-4 rounded-md bg-muted/40 p-2"
            >
              <span className="text-xs font-medium">{index + 1}.</span>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">When wired</p>
                <div className="flex flex-wrap gap-2">
                  {value.terminals.map((t) => (
                    <Check
                      key={t.uid}
                      label={t.id}
                      checked={m.whenWired.includes(t.uid)}
                      onChange={(on) =>
                        updateMode(m.uid, {
                          whenWired: toggle(m.whenWired, t.uid, on),
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Use branches</p>
                <div className="flex flex-wrap gap-2">
                  {value.branches.map((b) => (
                    <Check
                      key={b.uid}
                      label={b.id}
                      checked={m.branches.includes(b.uid)}
                      onChange={(on) =>
                        updateMode(m.uid, {
                          branches: toggle(m.branches, b.uid, on),
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="ml-auto">
                <RemoveButton
                  label={`Remove mode ${index + 1}`}
                  onClick={() =>
                    set({ modes: value.modes.filter((x) => x.uid !== m.uid) })
                  }
                />
              </div>
            </div>
          ))}
        </Section>
      </details>
    </div>
  );
}
