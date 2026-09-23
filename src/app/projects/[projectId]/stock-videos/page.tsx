import { StockVideosStudio } from "@/features/stock/stock-videos-studio";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <StockVideosStudio projectId={projectId} />;
}
