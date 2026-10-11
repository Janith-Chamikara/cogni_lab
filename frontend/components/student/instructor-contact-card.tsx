"use client";

import * as React from "react";
import { Check, Copy, GraduationCap, Mail } from "lucide-react";

import type { LabInstructor } from "@/lib/types";
import { Button } from "@/components/ui/button";

// Contact details of a lab's instructor, shown to students. `compact` fits
// the lab editor's sidebar; the default size is used on the dashboard.

const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;

export const instructorName = (instructor: LabInstructor) =>
  instructor.fullName?.trim() || "Your instructor";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

/** mailto link, with an optional subject, for a valid address only. */
const mailtoFor = (email: string | null, subject?: string) =>
  email && EMAIL.test(email)
    ? `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`
    : null;

type InstructorContactCardProps = {
  instructor: LabInstructor;
  /** Subject line for the email link, e.g. "Question about Lab 1". */
  emailSubject?: string;
  compact?: boolean;
  children?: React.ReactNode;
};

export function InstructorContactCard({
  instructor,
  emailSubject,
  compact = false,
  children,
}: InstructorContactCardProps) {
  const [copied, setCopied] = React.useState(false);
  const name = instructorName(instructor);
  const mailto = mailtoFor(instructor.email, emailSubject);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyEmail = async () => {
    if (!instructor.email) return;
    try {
      await navigator.clipboard.writeText(instructor.email);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the address is still visible to select.
    }
  };

  return (
    <div
      className={`rounded-lg border bg-card ${compact ? "p-3" : "p-4"} space-y-3`}
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${
            compact ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm"
          }`}
        >
          {initialsOf(name)}
        </div>
        <div className="min-w-0">
          <p
            className={`truncate font-semibold ${compact ? "text-sm" : "text-base"}`}
            title={name}
          >
            {name}
          </p>
          {instructor.university && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{instructor.university}</span>
            </p>
          )}
        </div>
      </div>

      {instructor.email ? (
        <div className="flex items-center gap-2">
          <p
            className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            title={instructor.email}
          >
            {instructor.email}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={copyEmail}
            aria-label={copied ? "Email copied" : "Copy email address"}
            title={copied ? "Copied" : "Copy email"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No contact email available.
        </p>
      )}

      {mailto && (
        <Button asChild size="sm" variant="outline" className="w-full gap-2">
          <a href={mailto}>
            <Mail className="h-3.5 w-3.5" />
            Email instructor
          </a>
        </Button>
      )}

      {children}
    </div>
  );
}

/** One-line instructor summary for lab cards: initials, name and email. */
export function InstructorChip({ instructor }: { instructor: LabInstructor }) {
  const name = instructorName(instructor);
  const mailto = mailtoFor(instructor.email);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
      >
        {initialsOf(name)}
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium" title={name}>
          {name}
        </p>
        {mailto ? (
          <a
            href={mailto}
            className="block truncate text-xs text-muted-foreground hover:text-primary hover:underline"
            title={instructor.email ?? undefined}
          >
            {instructor.email}
          </a>
        ) : (
          instructor.university && (
            <p className="truncate text-xs text-muted-foreground">
              {instructor.university}
            </p>
          )
        )}
      </div>
    </div>
  );
}
