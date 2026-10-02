import { StrategyStudio } from "@/features/strategy/strategy-studio";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <StrategyStudio projectId={projectId} />;
}
