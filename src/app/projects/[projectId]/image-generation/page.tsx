import { ImageGenerationStudio } from "@/features/generation/image-generation-studio";
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <ImageGenerationStudio projectId={projectId} />; }
