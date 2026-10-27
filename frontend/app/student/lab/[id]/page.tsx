import { getLab, getMyLabDraft } from "@/lib/actions";
import { redirect } from "next/navigation";
import { StudentLabEditor } from "./student-lab-editor";

export default async function StudentLabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [labResult, draftResult] = await Promise.all([
    getLab(id),
    getMyLabDraft(id),
  ]);

  if (labResult.error || !labResult.data) {
    redirect("/student/dashboard");
  }

  return (
    <StudentLabEditor
      lab={labResult.data}
      initialDraft={draftResult.data ?? null}
    />
  );
}
