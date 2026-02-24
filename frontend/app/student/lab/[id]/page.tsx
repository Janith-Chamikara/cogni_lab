import { getLab } from "@/lib/actions";
import { redirect } from "next/navigation";
import { StudentLabClient } from "./student-lab-client";

export default async function StudentLabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const labResult = await getLab(id);

  if (labResult.error || !labResult.data) {
    redirect("/student/dashboard");
  }

  return <StudentLabClient lab={labResult.data} />;
}
