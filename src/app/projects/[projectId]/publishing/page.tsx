import { PublishingStudio } from "@/features/publishing/publishing-studio";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ assetId?: string; packageId?: string }>;
}) {
  const { projectId } = await params;
  const sp = searchParams ? await searchParams : {};
  return <PublishingStudio projectId={projectId} initialAssetId={sp.packageId || sp.assetId} />;
}
