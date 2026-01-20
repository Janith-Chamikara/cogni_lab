"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  FlaskConical,
  Plus,
  Search,
  Eye,
  LayoutGrid,
  Users,
  TrendingUp,
  Calendar,
  Filter,
  MoreHorizontal,
  ArrowUpRight,
  Beaker,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Lab, LabStats, Module } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateLabDialog } from "@/components/lab/create-lab-dialog";

type DashboardClientProps = {
  initialLabs: Lab[];
  initialStats: LabStats;
  modules: Module[];
  error?: string;
};

const STATUS_CONFIG: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  NOT_STARTED: {
    color: "bg-muted text-muted-foreground border-border",
    icon: <Clock className="h-3 w-3" />,
    label: "Not Started",
  },
  IN_PROGRESS: {
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: <Beaker className="h-3 w-3" />,
    label: "In Progress",
  },
  COMPLETED: {
    color:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "Completed",
  },
};

export function DashboardClient({
  initialLabs,
  initialStats,
  modules,
  error,
}: DashboardClientProps) {
  const [labs, setLabs] = useState(initialLabs);
  const [stats, setStats] = useState(initialStats);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredLabs = labs.filter(
    (lab) =>
      lab.labName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.module?.moduleName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleLabCreated = (newLab: Lab) => {
    setLabs([newLab, ...labs]);
    setStats({ ...stats, totalLabs: stats.totalLabs + 1 });
    setIsCreateOpen(false);
  };

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 via-background to-muted/30">
      <div className="container mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage your virtual laboratories and experiments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search experiments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 bg-background pl-10 shadow-sm"
              />
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 shadow-md"
            >
              <Plus className="h-4 w-4" />
              Create Lab
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-violet-100">
                Total Labs
                <div className="rounded-full bg-white/20 p-2">
                  <FlaskConical className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.totalLabs}</div>
              <p className="mt-1 flex items-center gap-1 text-sm text-violet-200">
                <TrendingUp className="h-3 w-3" />
                Labs created
              </p>
            </CardContent>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-emerald-100">
                Active Experiments
                <div className="rounded-full bg-white/20 p-2">
                  <LayoutGrid className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.activeLabs}</div>
              <p className="mt-1 flex items-center gap-1 text-sm text-emerald-200">
                <ArrowUpRight className="h-3 w-3" />
                Currently running
              </p>
            </CardContent>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-amber-100">
                Student Submissions
                <div className="rounded-full bg-white/20 p-2">
                  <Users className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.totalProgress}</div>
              <p className="mt-1 flex items-center gap-1 text-sm text-amber-200">
                <CheckCircle2 className="h-3 w-3" />
                Total attempts
              </p>
            </CardContent>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-blue-100">
                Modules
                <div className="rounded-full bg-white/20 p-2">
                  <Calendar className="h-4 w-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{modules.length}</div>
              <p className="mt-1 flex items-center gap-1 text-sm text-blue-200">
                <Beaker className="h-3 w-3" />
                Course modules
              </p>
            </CardContent>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
          </Card>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-card shadow-sm">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="my-labs">My Labs</TabsTrigger>
              <TabsTrigger value="modules">Modules</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
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

          <TabsContent value="overview" className="space-y-6">
            {/* Labs Table Card */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="border-b bg-muted/50 px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      Recent Laboratories
                    </CardTitle>
                    <CardDescription>
                      A list of your recently created virtual lab experiments
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Lab
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-16 pl-6">#</TableHead>
                      <TableHead>Laboratory</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-16 pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLabs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="rounded-full bg-muted p-4">
                              <FlaskConical className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                              <p className="font-medium text-foreground">
                                No laboratories yet
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Create your first virtual lab experiment
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => setIsCreateOpen(true)}
                              className="mt-2 gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Create Lab
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLabs.map((lab, index) => {
                        const statusConfig =
                          STATUS_CONFIG[lab.completionStatus];
                        return (
                          <TableRow
                            key={lab.id}
                            className="group cursor-pointer transition-colors hover:bg-muted/50"
                          >
                            <TableCell className="pl-6 font-mono text-sm text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg">
                                  <FlaskConical className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="font-medium text-foreground">
                                    {lab.labName}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {lab.description?.slice(0, 40) ||
                                      "No description"}
                                    {lab.description &&
                                    lab.description.length > 40
                                      ? "..."
                                      : ""}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="font-normal"
                              >
                                {lab.module?.moduleName || "Unassigned"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`gap-1 ${statusConfig.color}`}
                              >
                                {statusConfig.icon}
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                  {lab._count?.experimentSteps || 0}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  steps
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(lab.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="pr-6">
                              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Link href={`/labs/${lab.id}`}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                    <DropdownMenuItem>
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive">
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-labs">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>My Laboratories</CardTitle>
                <CardDescription>
                  All laboratories you have created
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {labs.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-12">
                      <FlaskConical className="h-12 w-12 text-muted-foreground/30" />
                      <p className="mt-4 text-muted-foreground">
                        No labs created yet
                      </p>
                    </div>
                  ) : (
                    labs.map((lab) => (
                      <Link key={lab.id} href={`/labs/${lab.id}`}>
                        <Card className="group cursor-pointer transition-all hover:shadow-md">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                <FlaskConical className="h-5 w-5 text-primary" />
                              </div>
                              <Badge
                                variant="outline"
                                className={
                                  STATUS_CONFIG[lab.completionStatus].color
                                }
                              >
                                {STATUS_CONFIG[lab.completionStatus].label}
                              </Badge>
                            </div>
                            <CardTitle className="mt-3 text-lg group-hover:text-primary">
                              {lab.labName}
                            </CardTitle>
                            <CardDescription className="line-clamp-2">
                              {lab.description || "No description available"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>{lab.module?.moduleName}</span>
                              <span>
                                {lab._count?.experimentSteps || 0} steps
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Course Modules</CardTitle>
                <CardDescription>
                  Organize your labs by course modules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {modules.map((mod) => (
                    <Card
                      key={mod.id}
                      className="transition-all hover:shadow-md"
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Beaker className="h-5 w-5 text-primary" />
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
                            {mod._count?.labInstances || 0} labs
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>
                  Track student performance and lab usage
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-[300px] items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">
                    Analytics dashboard coming soon
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Lab Dialog */}
      <CreateLabDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        modules={modules}
        onCreated={handleLabCreated}
      />
    </div>
  );
}
