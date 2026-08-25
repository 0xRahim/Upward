import { LearnClient } from "./learn-client";

export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <LearnClient courseId={courseId} />;
}
