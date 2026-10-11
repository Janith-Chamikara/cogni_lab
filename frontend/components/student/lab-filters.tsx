"use client";

import * as React from "react";
import {
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfYear,
  subDays,
} from "date-fns";
import { Calendar, Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Filters for the student's lab lists: progress status, module, instructor
// and the date a lab was added.

export type LabStatusFilter =
  "all" | "not_started" | "in_progress" | "validated";

export type DatePreset = "any" | "7d" | "30d" | "90d" | "year" | "custom";

export type DateRange = {
  preset: DatePreset;
  /** yyyy-MM-dd, custom ranges only. Either end may be open. */
  from?: string;
  to?: string;
};

export type LabFilters = {
  status: LabStatusFilter;
  moduleId: string;
  instructorId: string;
  dateRange: DateRange;
};

export const DEFAULT_LAB_FILTERS: LabFilters = {
  status: "all",
  moduleId: "all",
  instructorId: "all",
  dateRange: { preset: "any" },
};

const STATUS_LABELS: Record<LabStatusFilter, string> = {
  all: "Any status",
  not_started: "Not started",
  in_progress: "Not validated yet",
  validated: "Validated",
};

const PRESET_LABELS: Record<Exclude<DatePreset, "custom">, string> = {
  any: "Any time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
};

type Option = { id: string; label: string };

/** The interval a date range covers, or null for "any time". */
const intervalOf = (range: DateRange, now = new Date()) => {
  switch (range.preset) {
    case "any":
      return null;
    case "7d":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "90d":
      return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) };
    case "year":
      return { start: startOfYear(now), end: endOfDay(now) };
    case "custom":
      return {
        start: range.from ? startOfDay(parseISO(range.from)) : new Date(0),
        end: range.to ? endOfDay(parseISO(range.to)) : new Date(8.64e15),
      };
  }
};

export const isInDateRange = (date: string, range: DateRange) => {
  const interval = intervalOf(range);
  if (!interval) return true;
  const value = parseISO(date);
  return !Number.isNaN(value.getTime()) && isWithinInterval(value, interval);
};

export const dateRangeLabel = (range: DateRange) => {
  if (range.preset !== "custom") return PRESET_LABELS[range.preset];
  const show = (value?: string) =>
    value ? format(parseISO(value), "d MMM yyyy") : null;
  const from = show(range.from);
  const to = show(range.to);
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return PRESET_LABELS.any;
};

/** How many filters (besides the date range) are not at their default. */
export const activeFilterCount = (filters: LabFilters) =>
  [
    filters.status !== "all",
    filters.moduleId !== "all",
    filters.instructorId !== "all",
  ].filter(Boolean).length;

export function LabFilterMenu({
  filters,
  onChange,
  modules,
  instructors,
}: {
  filters: LabFilters;
  onChange: (filters: LabFilters) => void;
  modules: Option[];
  instructors: Option[];
}) {
  const count = activeFilterCount(filters);
  const set = (patch: Partial<LabFilters>) =>
    onChange({ ...filters, ...patch });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
          {count > 0 && (
            <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[11px]">
              {count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[70vh] w-64 overflow-y-auto"
      >
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.status}
          onValueChange={(status) => set({ status: status as LabStatusFilter })}
        >
          {(Object.keys(STATUS_LABELS) as LabStatusFilter[]).map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              {STATUS_LABELS[status]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {modules.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Module</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.moduleId}
              onValueChange={(moduleId) => set({ moduleId })}
            >
              <DropdownMenuRadioItem value="all">
                All modules
              </DropdownMenuRadioItem>
              {modules.map((module) => (
                <DropdownMenuRadioItem key={module.id} value={module.id}>
                  <span className="truncate">{module.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}

        {instructors.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Instructor</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.instructorId}
              onValueChange={(instructorId) => set({ instructorId })}
            >
              <DropdownMenuRadioItem value="all">
                All instructors
              </DropdownMenuRadioItem>
              {instructors.map((instructor) => (
                <DropdownMenuRadioItem
                  key={instructor.id}
                  value={instructor.id}
                >
                  <span className="truncate">{instructor.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}

        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                set({ status: "all", moduleId: "all", instructorId: "all" })
              }
            >
              <X className="h-4 w-4" />
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DateRangeMenu({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [customOpen, setCustomOpen] = React.useState(false);
  const [from, setFrom] = React.useState(value.from ?? "");
  const [to, setTo] = React.useState(value.to ?? "");
  const invalid = !!from && !!to && from > to;

  const openCustom = () => {
    setFrom(value.from ?? "");
    setTo(value.to ?? "");
    setCustomOpen(true);
  };

  return (
    <>
      {/* Not modal, so focus is free for the custom range dialog it opens. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={value.preset === "any" ? "outline" : "secondary"}
            size="sm"
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            {value.preset === "any" ? "Date Range" : dateRangeLabel(value)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Lab added</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value.preset}
            onValueChange={(preset) => {
              if (preset === "custom") return;
              onChange({ preset: preset as DatePreset });
            }}
          >
            {(
              Object.keys(PRESET_LABELS) as Array<Exclude<DatePreset, "custom">>
            ).map((preset) => (
              <DropdownMenuRadioItem key={preset} value={preset}>
                {PRESET_LABELS[preset]}
              </DropdownMenuRadioItem>
            ))}
            <DropdownMenuRadioItem value="custom" onSelect={openCustom}>
              Custom range…
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Custom date range</DialogTitle>
            <DialogDescription>
              Show labs added between these dates. Leave a date empty to keep
              that end open.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="range-from">From</Label>
              <Input
                id="range-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="range-to">To</Label>
              <Input
                id="range-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          {invalid && (
            <p className="text-sm text-destructive">
              The start date must be before the end date.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={invalid}
              onClick={() => {
                onChange(
                  from || to
                    ? {
                        preset: "custom",
                        from: from || undefined,
                        to: to || undefined,
                      }
                    : { preset: "any" },
                );
                setCustomOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Removable chips for every active filter, plus "Clear all". */
export function ActiveFilterChips({
  filters,
  onChange,
  moduleName,
  instructorName,
}: {
  filters: LabFilters;
  onChange: (filters: LabFilters) => void;
  moduleName: (id: string) => string | undefined;
  instructorName: (id: string) => string | undefined;
}) {
  const chips: Array<{
    key: string;
    label: string;
    clear: Partial<LabFilters>;
  }> = [];
  if (filters.status !== "all") {
    chips.push({
      key: "status",
      label: STATUS_LABELS[filters.status],
      clear: { status: "all" },
    });
  }
  if (filters.moduleId !== "all") {
    chips.push({
      key: "module",
      label: `Module: ${moduleName(filters.moduleId) ?? "Unknown"}`,
      clear: { moduleId: "all" },
    });
  }
  if (filters.instructorId !== "all") {
    chips.push({
      key: "instructor",
      label: `Instructor: ${instructorName(filters.instructorId) ?? "Unknown"}`,
      clear: { instructorId: "all" },
    });
  }
  if (filters.dateRange.preset !== "any") {
    chips.push({
      key: "date",
      label: `Added: ${dateRangeLabel(filters.dateRange)}`,
      clear: { dateRange: { preset: "any" } },
    });
  }
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
          {chip.label}
          <button
            type="button"
            className="rounded-sm p-0.5 hover:bg-foreground/10"
            aria-label={`Remove filter ${chip.label}`}
            onClick={() => onChange({ ...filters, ...chip.clear })}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onChange(DEFAULT_LAB_FILTERS)}
      >
        Clear all
      </Button>
    </div>
  );
}
