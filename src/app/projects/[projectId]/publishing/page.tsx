import { PublishingStudio } from "@/features/publishing/publishing-studio";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <PublishingStudio projectId={projectId} />;
}
