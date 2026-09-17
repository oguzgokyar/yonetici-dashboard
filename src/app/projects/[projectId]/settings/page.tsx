import { BrandSettings } from "@/features/projects/brand-settings";
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <BrandSettings projectId={projectId} />; }
