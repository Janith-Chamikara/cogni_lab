import { Lab } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LabCatalogCardProps {
  lab: Lab;
}

export function LabCatalogCard({ lab }: LabCatalogCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-lg line-clamp-2">{lab.labName}</h3>
            {lab.module && (
              <p className="text-sm text-gray-500 mt-1">
                {lab.module.moduleName}
              </p>
            )}
          </div>
          <Badge className={getStatusColor(lab.completionStatus)}>
            {lab.completionStatus.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {lab.description && (
          <p className="text-sm text-gray-600 line-clamp-3">
            {lab.description}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          {lab._count?.labEquipments && (
            <Badge variant="outline">
              {lab._count.labEquipments} equipment
            </Badge>
          )}
          {lab._count?.experimentSteps && (
            <Badge variant="outline">
              {lab._count.experimentSteps} steps
            </Badge>
          )}
        </div>

        {lab.toleranceUnit && (
          <div className="text-xs text-gray-500 pt-2 border-t">
            <p>
              Tolerance: {lab.toleranceMin} - {lab.toleranceMax} {lab.toleranceUnit}
            </p>
          </div>
        )}

        {lab.instructor && (
          <div className="text-xs text-gray-500 pt-2 border-t">
            <p>By: {lab.instructor.fullName || lab.instructor.email}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
