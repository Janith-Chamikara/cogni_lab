import {
  getFollowedLabs,
  getLabEquipments,
  getModules,
  getMyAttemptSummary,
  getPublishedLabs,
} from "@/lib/actions";
import { StudentDashboardClient } from "./student-dashboard-client";

export default async function StudentDashboardPage() {
  const [
    labsResult,
    modulesResult,
    equipmentResult,
    attemptsResult,
    followedLabsResult,
  ] = await Promise.all([
    getPublishedLabs(),
    getModules(),
    getLabEquipments(),
    getMyAttemptSummary(),
    getFollowedLabs(),
  ]);

  return (
    <StudentDashboardClient
      initialLabs={labsResult.data ?? []}
      initialModules={modulesResult.data ?? []}
      initialEquipment={equipmentResult.data ?? []}
      attemptSummary={attemptsResult.data ?? []}
      followedLabs={followedLabsResult.data ?? []}
    />
  );
}
