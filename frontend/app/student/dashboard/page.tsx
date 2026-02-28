import { getLabEquipments, getModules, getPublishedLabs } from "@/lib/actions";
import { StudentDashboardClient } from "./student-dashboard-client";

export default async function StudentDashboardPage() {
  const [labsResult, modulesResult, equipmentResult] = await Promise.all([
    getPublishedLabs(),
    getModules(),
    getLabEquipments(),
  ]);

  return (
    <StudentDashboardClient
      initialLabs={labsResult.data ?? []}
      initialModules={modulesResult.data ?? []}
      initialEquipment={equipmentResult.data ?? []}
    />
  );
}
