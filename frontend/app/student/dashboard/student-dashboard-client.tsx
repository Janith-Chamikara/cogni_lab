"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, BookOpen, CheckCircle2, Clock } from "lucide-react";
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
  const [selectedModule, setSelectedModule] = React.useState<string>("all");

  const filteredLabs = React.useMemo(() => {
    if (selectedModule === "all") return initialLabs;
    return initialLabs.filter((lab) => lab.moduleId === selectedModule);
  }, [initialLabs, selectedModule]);

  const stats = React.useMemo(() => {
    return {
      totalLabs: initialLabs.length,
      completed: 0, // TODO: Get from progress tracking
      inProgress: 0, // TODO: Get from progress tracking
      available: initialLabs.length,
    };
  }, [initialLabs]);

  const handleStartLab = (labId: string) => {
    router.push(`/student/lab/${labId}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Explore and complete virtual lab experiments
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card style={{ backgroundColor: '#2872db' }} className="border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Available Labs
            </CardTitle>
            <FlaskConical className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.available}</div>
            <p className="text-xs text-white/80">
              Ready to start
            </p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#a52b2b' }} className="border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.inProgress}</div>
            <p className="text-xs text-white/80">
              Currently working on
            </p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#b78407' }} className="border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.completed}</div>
            <p className="text-xs text-white/80">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#309053' }} className="border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Modules</CardTitle>
            <BookOpen className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{initialModules.length}</div>
            <p className="text-xs text-white/80">
              Course modules
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module Filter Tabs */}
      <Tabs value={selectedModule} onValueChange={setSelectedModule}>
        <TabsList>
          <TabsTrigger value="all">All Labs</TabsTrigger>
          {initialModules.map((module) => (
            <TabsTrigger key={module.id} value={module.id}>
              {module.moduleName}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedModule} className="mt-6">
          {/* Labs Grid */}
          {filteredLabs.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No labs available</h3>
                <p className="text-muted-foreground mt-2">
                  Check back later for new experiments
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
                        <CardTitle className="line-clamp-1">{lab.labName}</CardTitle>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
