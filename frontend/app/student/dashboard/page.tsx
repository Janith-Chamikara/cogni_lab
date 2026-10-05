import {
  getLabEquipments,
  getModules,
  getMyAttemptSummary,
  getPublishedLabs,
} from "@/lib/actions";
import { StudentDashboardClient } from "./student-dashboard-client";

export default async function StudentDashboardPage() {
  const [labsResult, modulesResult, equipmentResult, attemptsResult] =
    await Promise.all([
      getPublishedLabs(),
      getModules(),
      getLabEquipments(),
      getMyAttemptSummary(),
    ]);

  return (
    <StudentDashboardClient
      initialLabs={labsResult.data ?? []}
      initialModules={modulesResult.data ?? []}
      initialEquipment={equipmentResult.data ?? []}
      attemptSummary={attemptsResult.data ?? []}
    />
  );
}
