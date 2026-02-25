"use client";

import * as React from "react";
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
  Filter,
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
import type { Lab, Module, LabEquipment } from "@/lib/types";

interface StudentDashboardClientProps {
  initialLabs: Lab[];
  initialModules: Module[];
  initialEquipment: LabEquipment[];
}

export function StudentDashboardClient({
  initialLabs,
  initialModules,
  initialEquipment,
}: StudentDashboardClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedModule, setSelectedModule] = React.useState<string>("all");

  const filteredLabs = React.useMemo(() => {
    const byModule =
      selectedModule === "all"
        ? initialLabs
        : initialLabs.filter((lab) => lab.moduleId === selectedModule);

    if (!searchQuery) return byModule;

    return byModule.filter(
      (lab) =>
        lab.labName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lab.module?.moduleName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );
  }, [initialLabs, selectedModule, searchQuery]);

  const stats = React.useMemo(
    () => ({
      totalLabs: initialLabs.length,
      completed: 0, // TODO: hook to progress tracking
      inProgress: 0, // TODO: hook to progress tracking
      available: initialLabs.length,
      modules: initialModules.length,
      totalEquipment: initialEquipment.length,
    }),
    [initialLabs, initialModules, initialEquipment],
  );

  const handleStartLab = (labId: string) => {
    router.push(`/student/lab/${labId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 via-background to-muted/30">
      <div className="container mx-auto max-w-7xl space-y-8 px-6 py-8">
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
                placeholder="Search labs..."
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
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-card shadow-sm">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="labs">Labs</TabsTrigger>
              <TabsTrigger value="modules">Modules</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </Button>
            </div>
          </div>

          {/* Overview: quick summary using the same labs grid component students already had */}
          <TabsContent value="overview" className="space-y-6">
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
                        No labs available
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        Check back later for new experiments.
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredLabs.slice(0, 6).map((lab) => (
                      <Card key={lab.id} className="flex flex-col">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="line-clamp-1">
                                {lab.labName}
                              </CardTitle>
                              <CardDescription className="mt-2 line-clamp-2">
                                {lab.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {lab.labEquipments?.length || 0} Equipment
                              </Badge>
                              <Badge variant="outline">
                                {lab.experimentSteps?.length || 0} Steps
                              </Badge>
                            </div>
                            {lab.module && (
                              <div className="text-sm text-muted-foreground">
                                Module: {lab.module.moduleName}
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            className="w-full"
                            onClick={() => handleStartLab(lab.id)}
                          >
                            Start Experiment
                          </Button>
                        </CardFooter>
                      </Card>
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
                    variant={selectedModule === "all" ? "default" : "outline"}
                    onClick={() => setSelectedModule("all")}
                  >
                    All Labs
                  </Button>
                  {initialModules.map((module) => (
                    <Button
                      key={module.id}
                      size="sm"
                      variant={
                        selectedModule === module.id ? "default" : "outline"
                      }
                      onClick={() => setSelectedModule(module.id)}
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
                        No labs available
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        Try a different module or check back later.
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredLabs.map((lab) => (
                      <Card key={lab.id} className="flex flex-col">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="line-clamp-1">
                                {lab.labName}
                              </CardTitle>
                              <CardDescription className="mt-2 line-clamp-2">
                                {lab.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {lab.labEquipments?.length || 0} Equipment
                              </Badge>
                              <Badge variant="outline">
                                {lab.experimentSteps?.length || 0} Steps
                              </Badge>
                            </div>
                            {lab.module && (
                              <div className="text-sm text-muted-foreground">
                                Module: {lab.module.moduleName}
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            className="w-full"
                            onClick={() => handleStartLab(lab.id)}
                          >
                            Start Experiment
                          </Button>
                        </CardFooter>
                      </Card>
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
        </Tabs>
      </div>
    </div>
  );
}
