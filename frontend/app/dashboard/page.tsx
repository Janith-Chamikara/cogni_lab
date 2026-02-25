import {
  getLabEquipments,
  getLabStats,
  getModules,
  getMyLabs,
  getMyModules,
} from "@/lib/actions";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const [labsResult, statsResult, myModulesResult, allModulesResult, equipmentResult] =
    await Promise.all([
      getMyLabs(),
      getLabStats(),
      getMyModules(), // Get user's own modules
      getModules(), // Fetch all modules for lab creation
      getLabEquipments(),
    ]);

  return (
    <DashboardClient
      initialLabs={labsResult.data ?? []}
      initialStats={
        statsResult.data ?? { totalLabs: 0, activeLabs: 0, totalProgress: 0 }
      }
      myModules={myModulesResult.data ?? []}
      allModules={allModulesResult.data ?? []}
      initialEquipments={equipmentResult.data ?? []}
      error={
        labsResult.error ||
        statsResult.error ||
        myModulesResult.error ||
        equipmentResult.error
      }
    />
  );
}
