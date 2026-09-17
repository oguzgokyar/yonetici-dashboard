import { ProjectHub } from "@/features/projects/project-hub";
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <ProjectHub projectId={projectId} />; }
