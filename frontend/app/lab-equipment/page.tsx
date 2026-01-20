"use client";

import { useEffect, useMemo, useState } from "react";
import { getLabEquipments } from "@/lib/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateLabEquipmentDialog } from "@/components/lab-equipment/create-lab-equipment-dialog";
import { LabEquipmentCard } from "@/components/lab-equipment/lab-equipment-card";
import { LabEquipment } from "@/lib/types";

export default function LabEquipmentPage() {
  const [labEquipments, setLabEquipments] = useState<LabEquipment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadEquipments = async () => {
      setIsLoading(true);
      const result = await getLabEquipments();

      if (!isActive) {
        return;
      }

      if (result.error) {
        setLoadError(result.error);
        setLabEquipments([]);
      } else {
        setLoadError(null);
        setLabEquipments(result.data ?? []);
      }

      setIsLoading(false);
    };

    loadEquipments();

    return () => {
      isActive = false;
    };
  }, []);

  const handleEquipmentCreated = (equipment: LabEquipment) => {
    setLabEquipments((prev) => [equipment, ...prev]);
  };

  const filteredEquipments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return labEquipments;
    }

    return labEquipments.filter((equipment) => {
      return (
        equipment.equipmentName.toLowerCase().includes(query) ||
        equipment.equipmentType.toLowerCase().includes(query) ||
        equipment.description?.toLowerCase().includes(query)
      );
    });
  }, [labEquipments, searchQuery]);

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Lab equipment</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create and manage lab equipment. Upload images to Cloudinary and
            configure defaults for experiments.
          </p>
        </header>

        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Available equipment</h2>
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Loading equipment list..."
                  : `${filteredEquipments.length} items`}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search equipment"
                className="sm:w-64"
              />
              <Button onClick={() => setIsCreateOpen(true)}>
                Create equipment
              </Button>
            </div>
          </div>

          {loadError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && filteredEquipments.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No equipment yet. Create the first one using the button.
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEquipments.map((equipment) => (
              <LabEquipmentCard key={equipment.id} equipment={equipment} />
            ))}
          </div>
        </div>
      </div>

      <CreateLabEquipmentDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleEquipmentCreated}
      />
    </div>
  );
}
