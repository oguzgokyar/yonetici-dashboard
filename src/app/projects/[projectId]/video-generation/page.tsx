import { VideoGenerationStudio } from "@/features/generation/video-generation-studio";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <VideoGenerationStudio projectId={projectId} />;
}
