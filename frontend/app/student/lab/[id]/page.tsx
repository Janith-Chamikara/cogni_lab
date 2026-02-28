import { getLab } from "@/lib/actions";
import { redirect } from "next/navigation";
import { StudentLabEditor } from "./student-lab-editor";

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

  return <StudentLabEditor lab={labResult.data} />;
}
