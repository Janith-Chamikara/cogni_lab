import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface LabFilterBarProps {
  modules: string[];
  selectedModule: string | null;
  onModuleChange: (module: string | null) => void;
}

export function LabFilterBar({
  modules,
  selectedModule,
  onModuleChange,
}: LabFilterBarProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Filter by Module</label>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedModule === null ? "default" : "outline"}
          onClick={() => onModuleChange(null)}
          size="sm"
        >
          All Modules
        </Button>

        {modules.map((module) => (
          <Button
            key={module}
            variant={selectedModule === module ? "default" : "outline"}
            onClick={() => onModuleChange(selectedModule === module ? null : module)}
            size="sm"
            className="flex items-center gap-1"
          >
            {module}
            {selectedModule === module && (
              <X className="w-3 h-3" />
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
