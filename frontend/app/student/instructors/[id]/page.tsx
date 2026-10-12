import {
  getInstructorProfile,
  getMyAttemptSummary,
  getMyDraftSummary,
} from "@/lib/actions";
import { redirect } from "next/navigation";
import { InstructorProfileClient } from "./instructor-profile-client";

export default async function InstructorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profileResult, attemptsResult, draftsResult] = await Promise.all([
    getInstructorProfile(id),
    getMyAttemptSummary(),
    getMyDraftSummary(),
  ]);

  if (profileResult.error || !profileResult.data) {
    redirect("/student/instructors");
  }

  return (
    <InstructorProfileClient
      profile={profileResult.data}
      attemptSummary={attemptsResult.data ?? []}
      draftSummary={draftsResult.data ?? []}
    />
  );
}
