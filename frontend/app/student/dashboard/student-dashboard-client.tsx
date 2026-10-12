"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FlaskConical,
  BookOpen,
  CheckCircle2,
  Clock,
  Search,
  LayoutGrid,
  TrendingUp,
  Calendar,
  Users,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import type {
  Lab,
  Module,
  LabEquipment,
  LabAttemptSummary,
  LabInstructor,
} from "@/lib/types";
import {
  InstructorChip,
  InstructorContactCard,
  instructorName,
} from "@/components/student/instructor-contact-card";
import {
  ActiveFilterChips,
  DateRangeMenu,
  DEFAULT_LAB_FILTERS,
  LabFilterMenu,
  activeFilterCount,
  isInDateRange,
  type LabFilters,
  type LabStatusFilter,
} from "@/components/student/lab-filters";

/** An instructor with the labs (and their modules) a student can open. */
type InstructorWithLabs = {
  instructor: LabInstructor;
  labs: Lab[];
  modules: string[];
};

interface StudentDashboardClientProps {
  initialLabs: Lab[];
  initialModules: Module[];
  initialEquipment: LabEquipment[];
  attemptSummary: LabAttemptSummary[];
  /** Labs from the instructors the student follows. */
  followedLabs: Lab[];
}

/** Shows the student's best result for a lab, if they have submitted it. */
function LabProgressBadge({ summary }: { summary?: LabAttemptSummary }) {
  if (!summary) return null;

  return summary.passed ? (
    <Badge className="gap-1 bg-green-500">
      <CheckCircle2 className="h-3 w-3" />
      Validated
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" />
      Not validated yet
    </Badge>
  );
}

/** Where the student stands on a lab, from their best attempt. */
const statusOf = (summary?: LabAttemptSummary): LabStatusFilter =>
  !summary ? "not_started" : summary.passed ? "validated" : "in_progress";

export function LabCard({
  lab,
  summary,
  onStart,
}: {
  lab: Lab;
  summary?: LabAttemptSummary;
  onStart: () => void;
}) {
  // The lab list sends counts; a single lab sends the full lists.
  const equipmentCount =
    lab._count?.labEquipments ?? lab.labEquipments?.length ?? 0;
  const stepCount =
    lab._count?.experimentSteps ?? lab.experimentSteps?.length ?? 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="line-clamp-1" title={lab.labName}>
          {lab.labName}
        </CardTitle>
        <CardDescription className="mt-2 line-clamp-2">
          {lab.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {equipmentCount} {equipmentCount === 1 ? "Part" : "Parts"}
          </Badge>
          <Badge variant="outline">
            {stepCount} {stepCount === 1 ? "Step" : "Steps"}
          </Badge>
          <LabProgressBadge summary={summary} />
        </div>
        {lab.module && (
          <div className="text-sm text-muted-foreground">
            Module: {lab.module.moduleName}
          </div>
        )}
        {lab.instructor && (
          <div className="border-t pt-3">
            <InstructorChip instructor={lab.instructor} />
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={onStart}
          data-ai-action="navigate"
          data-ai-href={`/student/lab/${lab.id}`}
          data-ai-label={`Open ${lab.labName}`}
        >
          Start Experiment
        </Button>
      </CardFooter>
    </Card>
  );
}

export function StudentDashboardClient({
  initialLabs,
  initialModules,
  initialEquipment,
  attemptSummary,
  followedLabs,
}: StudentDashboardClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filters, setFilters] =
    React.useState<LabFilters>(DEFAULT_LAB_FILTERS);
  const [tab, setTab] = React.useState("overview");
  const setModule = (moduleId: string) =>
    setFilters((current) => ({ ...current, moduleId }));

  // Instructors of the available labs, A–Z, filtered by the search box.
  const instructors = React.useMemo(() => {
    const byId = new Map<string, InstructorWithLabs>();
    for (const lab of initialLabs) {
      if (!lab.instructor) continue;
      const entry = byId.get(lab.instructor.id) ?? {
        instructor: lab.instructor,
        labs: [],
        modules: [],
      };
      entry.labs.push(lab);
      const moduleName = lab.module?.moduleName;
      if (moduleName && !entry.modules.includes(moduleName)) {
        entry.modules.push(moduleName);
      }
      byId.set(lab.instructor.id, entry);
    }

    const query = searchQuery.trim().toLowerCase();
    return [...byId.values()]
      .filter(
        ({ instructor, modules }) =>
          !query ||
          [
            instructor.fullName,
            instructor.email,
            instructor.university,
            ...modules,
          ].some((text) => text?.toLowerCase().includes(query)),
      )
      .sort((a, b) =>
        instructorName(a.instructor).localeCompare(
          instructorName(b.instructor),
        ),
      );
  }, [initialLabs, searchQuery]);

  // Only count attempts for labs that are still listed.
  const attemptsByLab = React.useMemo(() => {
    const labIds = new Set(initialLabs.map((lab) => lab.id));
    return new Map(
      attemptSummary
        .filter((summary) => labIds.has(summary.labId))
        .map((summary) => [summary.labId, summary]),
    );
  }, [initialLabs, attemptSummary]);

  const filteredLabs = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return initialLabs.filter(
      (lab) =>
        (filters.moduleId === "all" || lab.moduleId === filters.moduleId) &&
        (filters.instructorId === "all" ||
          lab.instructorId === filters.instructorId) &&
        (filters.status === "all" ||
          statusOf(attemptsByLab.get(lab.id)) === filters.status) &&
        isInDateRange(lab.createdAt, filters.dateRange) &&
        (!query ||
          [
            lab.labName,
            lab.module?.moduleName,
            lab.instructor?.fullName,
          ].some((text) => text?.toLowerCase().includes(query))),
    );
  }, [initialLabs, attemptsByLab, filters, searchQuery]);

  const isFiltered =
    !!searchQuery.trim() ||
    activeFilterCount(filters) > 0 ||
    filters.dateRange.preset !== "any";

  // Options for the filter menu: modules and instructors that have labs.
  const moduleOptions = React.useMemo(
    () =>
      initialModules
        .filter((mod) => initialLabs.some((lab) => lab.moduleId === mod.id))
        .map((mod) => ({ id: mod.id, label: mod.moduleName })),
    [initialModules, initialLabs],
  );
  const instructorOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const lab of initialLabs) {
      if (lab.instructor) {
        byId.set(lab.instructor.id, instructorName(lab.instructor));
      }
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [initialLabs]);
  const showLabFilters = tab === "overview" || tab === "labs";

  const stats = React.useMemo(() => {
    const summaries = [...attemptsByLab.values()];
    return {
      totalLabs: initialLabs.length,
      // Completed = the student's best attempt passed.
      completed: summaries.filter((s) => s.passed).length,
      // In progress = submitted at least once but not passed yet.
      inProgress: summaries.filter((s) => !s.passed).length,
      available: initialLabs.length,
      modules: initialModules.length,
      totalEquipment: initialEquipment.length,
    };
  }, [initialLabs, initialModules, initialEquipment, attemptsByLab]);

  const handleStartLab = (labId: string) => {
    router.push(`/student/lab/${labId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 via-background to-muted/30">
      <div className="container mx-auto max-w-[96rem] space-y-8 px-6 py-8">
        {/* Header Section (matches main dashboard) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Student Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Explore and complete your assigned virtual laboratories
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search labs and instructors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 bg-background pl-10 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Stats Grid – styled like main dashboard but with student-focused copy */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-violet-100">
                Available Labs
                <div className="rounded-full bg-white/20 p-2">
                  <FlaskConical className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.available}</div>
              <p className="mt-1 flex items-center gap-1 text-sm text-violet-200">
                <TrendingUp className="h-3 w-3" />
                Ready to start
              </p>
            </CardContent>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-emerald-100">
                In Progress
                <div className="rounded-full bg-white/20 p-2">
                  <Clock className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.inProgress}</div>
              <p className="mt-1 flex items-center gap-1 text-sm text-emerald-200">
                <LayoutGrid className="h-3 w-3" />
                Currently working on
              </p>
            </CardContent>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-amber-100">
                Completed Labs
                <div className="rounded-full bg-white/20 p-2">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.completed}</div>
              <p className="mt-1 flex items-center gap-1 text-sm text-amber-200">
                <CheckCircle2 className="h-3 w-3" />
                Successfully finished
              </p>
            </CardContent>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-blue-100">
                Modules
                <div className="rounded-full bg-white/20 p-2">
                  <BookOpen className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.modules}</div>
              <p className="mt-1 flex items-center gap-1 text-sm text-blue-200">
                <Calendar className="h-3 w-3" />
                Course modules
              </p>
            </CardContent>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
          </Card>
        </div>

        {/* Tabs Section – mirrors main dashboard structure */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="bg-card shadow-sm">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="labs">Labs</TabsTrigger>
              <TabsTrigger value="modules">Modules</TabsTrigger>
              <TabsTrigger value="instructors">Instructors</TabsTrigger>
            </TabsList>
            {showLabFilters && (
              <div className="flex items-center gap-2">
                <LabFilterMenu
                  filters={filters}
                  onChange={setFilters}
                  modules={moduleOptions}
                  instructors={instructorOptions}
                />
                <DateRangeMenu
                  value={filters.dateRange}
                  onChange={(dateRange) =>
                    setFilters((current) => ({ ...current, dateRange }))
                  }
                />
              </div>
            )}
          </div>

          {showLabFilters && (
            <ActiveFilterChips
              filters={filters}
              onChange={setFilters}
              moduleName={(id) =>
                moduleOptions.find((option) => option.id === id)?.label
              }
              instructorName={(id) =>
                instructorOptions.find((option) => option.id === id)?.label
              }
            />
          )}

          {/* Overview: quick summary using the same labs grid component students already had */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>Following</CardTitle>
                  <CardDescription>
                    Latest labs from the instructors you follow
                  </CardDescription>
                </div>
                {followedLabs.length > 0 && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/student/instructors">Manage</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {followedLabs.length === 0 ? (
                  <div className="py-10 text-center">
                    <UserPlus className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">
                      You are not following any instructors yet
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      Follow instructors to see their labs here.
                    </p>
                    <Button asChild className="mt-4">
                      <Link
                        href="/student/instructors"
                        data-ai-action="navigate"
                        data-ai-href="/student/instructors"
                        data-ai-label="Find instructors to follow"
                      >
                        Find instructors
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {followedLabs.slice(0, 6).map((lab) => (
                      <LabCard
                        key={lab.id}
                        lab={lab}
                        summary={attemptsByLab.get(lab.id)}
                        onStart={() => handleStartLab(lab.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Pick a lab below to begin your virtual experiment journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredLabs.length === 0 ? (
                  <Card className="p-12">
                    <div className="text-center">
                      <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">
                        {isFiltered
                          ? "No labs match your filters"
                          : "No labs available"}
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        {isFiltered
                          ? "Try clearing some filters or the search."
                          : "Check back later for new experiments."}
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredLabs.slice(0, 6).map((lab) => (
                      <LabCard
                        key={lab.id}
                        lab={lab}
                        summary={attemptsByLab.get(lab.id)}
                        onStart={() => handleStartLab(lab.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Labs tab – keeps your original student labs grid and module filtering logic */}
          <TabsContent value="labs">
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-muted/50">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-xl">All Labs</CardTitle>
                    <CardDescription>
                      Filter by module and start any available experiment
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={filters.moduleId === "all" ? "default" : "outline"}
                    onClick={() => setModule("all")}
                  >
                    All Labs
                  </Button>
                  {initialModules.map((module) => (
                    <Button
                      key={module.id}
                      size="sm"
                      variant={
                        filters.moduleId === module.id ? "default" : "outline"
                      }
                      onClick={() => setModule(module.id)}
                    >
                      {module.moduleName}
                    </Button>
                  ))}
                </div>

                {filteredLabs.length === 0 ? (
                  <Card className="p-12">
                    <div className="text-center">
                      <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">
                        {isFiltered
                          ? "No labs match your filters"
                          : "No labs available"}
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        {isFiltered
                          ? "Try a different module, clear some filters or the search."
                          : "Check back later for new experiments."}
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredLabs.map((lab) => (
                      <LabCard
                        key={lab.id}
                        lab={lab}
                        summary={attemptsByLab.get(lab.id)}
                        onStart={() => handleStartLab(lab.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modules tab – similar to instructor view but read-only for students */}
          <TabsContent value="modules">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Course Modules</CardTitle>
                <CardDescription>
                  Browse modules and see how many labs are available in each.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {initialModules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No modules available yet.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {initialModules.map((mod) => (
                      <Card
                        key={mod.id}
                        className="transition-all hover:shadow-md"
                      >
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <FlaskConical className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base">
                                {mod.moduleName}
                              </CardTitle>
                              {mod.moduleCode && (
                                <Badge variant="secondary" className="mt-1">
                                  {mod.moduleCode}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {mod.description || "No description"}
                          </p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              {
                                initialLabs.filter(
                                  (lab) => lab.moduleId === mod.id,
                                ).length
                              }{" "}
                              labs
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Instructors tab – who runs the available labs, and how to reach them */}
          <TabsContent value="instructors">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <CardTitle>Instructors</CardTitle>
                    <CardDescription>
                      Instructors of your available labs. Contact them if you
                      need help with an experiment.
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/student/instructors">
                      Browse all instructors
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {instructors.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">
                      {searchQuery
                        ? "No instructors match your search"
                        : "No instructors yet"}
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      {searchQuery
                        ? "Try a different name, email or module."
                        : "Instructors appear here once their labs are available."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {instructors.map(({ instructor, labs, modules }) => (
                      <InstructorContactCard
                        key={instructor.id}
                        instructor={instructor}
                      >
                        {modules.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {modules.map((name) => (
                              <Badge key={name} variant="secondary">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="space-y-1 border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {labs.length} {labs.length === 1 ? "lab" : "labs"}
                          </p>
                          <ul className="space-y-0.5">
                            {labs.map((lab) => (
                              <li key={lab.id}>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                                  onClick={() => handleStartLab(lab.id)}
                                  data-ai-action="navigate"
                                  data-ai-href={`/student/lab/${lab.id}`}
                                  data-ai-label={`Open ${lab.labName}`}
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    {lab.labName}
                                  </span>
                                  {attemptsByLab.get(lab.id)?.passed && (
                                    <CheckCircle2
                                      className="h-3.5 w-3.5 shrink-0 text-green-600"
                                      aria-label="Validated"
                                    />
                                  )}
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </InstructorContactCard>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
