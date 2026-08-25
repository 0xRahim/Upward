import { AdminCurriculum } from "./admin-curriculum";

export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <AdminCurriculum courseId={courseId} />;
}
