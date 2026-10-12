import { getInstructors } from "@/lib/actions";
import { InstructorsClient } from "./instructors-client";

export default async function StudentInstructorsPage() {
  const instructorsResult = await getInstructors();

  return (
    <InstructorsClient
      initialInstructors={instructorsResult.data ?? []}
      error={instructorsResult.error}
    />
  );
}
