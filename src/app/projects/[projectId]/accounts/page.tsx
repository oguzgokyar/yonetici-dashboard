import { ProjectAccounts } from "@/features/accounts/project-accounts";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectAccounts projectId={projectId} />;
}
