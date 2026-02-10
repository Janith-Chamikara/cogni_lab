"use client";

import { useEffect, useMemo, useState } from "react";
import { getModules } from "@/lib/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateModuleDialog } from "@/components/modules/create-module-dialog";
import { ModuleCard } from "@/components/modules/module-card";
import { Module } from "@/lib/types";

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadModules = async () => {
      setIsLoading(true);
      const result = await getModules();

      if (!isActive) {
        return;
      }

      if (result.error) {
        setLoadError(result.error);
        setModules([]);
      } else {
        setLoadError(null);
        setModules(result.data ?? []);
      }

      setIsLoading(false);
    };

    loadModules();

    return () => {
      isActive = false;
    };
  }, []);

  const handleModuleCreated = (module: Module) => {
    setModules((prev) => [module, ...prev]);
  };

  const filteredModules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return modules;
    }

    return modules.filter((module) => {
      return (
        module.moduleName.toLowerCase().includes(query) ||
        module.moduleCode?.toLowerCase().includes(query) ||
        module.description?.toLowerCase().includes(query)
      );
    });
  }, [modules, searchQuery]);

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Modules</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create and manage educational modules. Organize labs and equipment
            assignments for your courses.
          </p>
        </header>

        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Available modules</h2>
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Loading modules list..."
                  : `${filteredModules.length} items`}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search modules"
                className="sm:w-64"
              />
              <Button onClick={() => setIsCreateOpen(true)}>
                Create module
              </Button>
            </div>
          </div>

          {loadError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && filteredModules.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No modules yet. Create the first one using the button.
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredModules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </div>
      </div>

      <CreateModuleDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleModuleCreated}
      />
    </div>
  );
}
