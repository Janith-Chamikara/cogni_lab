import {
  getLabEquipments,
  getLabStats,
  getModules,
  getMyLabs,
} from "@/lib/actions";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  // The role lives in publicMetadata (set at onboarding). The session token
  // can lag right after onboarding, so fall back to the Clerk user record.
  const userRole =
    session.sessionClaims?.metadata?.role ??
    ((await currentUser())?.publicMetadata?.role as string | undefined);

  // Redirect students to their dashboard
  if (userRole === "STUDENT") {
    redirect("/student/dashboard");
  }

  const [labsResult, statsResult, modulesResult, equipmentResult] =
    await Promise.all([
      getMyLabs(),
      getLabStats(),
      getModules(), // Fetch all modules so users can create labs in any module
      getLabEquipments(),
    ]);

  return (
    <DashboardClient
      initialLabs={labsResult.data ?? []}
      initialStats={
        statsResult.data ?? { totalLabs: 0, activeLabs: 0, totalProgress: 0 }
      }
      modules={modulesResult.data ?? []}
      initialEquipments={equipmentResult.data ?? []}
      error={
        labsResult.error ||
        statsResult.error ||
        modulesResult.error ||
        equipmentResult.error
      }
    />
  );
}
