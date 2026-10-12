import {
  getFollowedLabs,
  getLabEquipments,
  getModules,
  getMyDraftSummary,
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
    draftsResult,
  ] = await Promise.all([
    getPublishedLabs(),
    getModules(),
    getLabEquipments(),
    getMyAttemptSummary(),
    getFollowedLabs(),
    getMyDraftSummary(),
  ]);

  return (
    <StudentDashboardClient
      initialLabs={labsResult.data ?? []}
      initialModules={modulesResult.data ?? []}
      initialEquipment={equipmentResult.data ?? []}
      attemptSummary={attemptsResult.data ?? []}
      followedLabs={followedLabsResult.data ?? []}
      draftSummary={draftsResult.data ?? []}
    />
  );
}
