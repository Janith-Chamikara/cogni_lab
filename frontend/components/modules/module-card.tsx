import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Module } from "@/lib/types";

interface ModuleCardProps {
  module: Module;
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <Link href={`/modules/${module.id}`}>
      <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="line-clamp-2">{module.moduleName}</CardTitle>
              {module.moduleCode && (
                <CardDescription className="mt-1">{module.moduleCode}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {module.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {module.description}
            </p>
          )}
          
          <div className="flex flex-col gap-2 pt-2">
            {module.instructor && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Instructor:</span>{" "}
                {module.instructor.fullName || module.instructor.email}
              </div>
            )}
            
            {module._count?.labInstances !== undefined && (
              <Badge variant="secondary" className="w-fit">
                {module._count.labInstances} lab{module._count.labInstances !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
