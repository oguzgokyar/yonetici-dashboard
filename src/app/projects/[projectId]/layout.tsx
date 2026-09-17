"use client";

import { usePathname } from "next/navigation";
import { use } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useProjects } from "@/features/projects/projects-context";

const titles: Record<string, string> = { overview: "Genel Bakış", "image-generation": "Görsel Üret", "video-generation": "Video Üret", publishing: "Paylaşım Planı", pinterest: "Pinterest", settings: "Proje Ayarları" };

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const pathname = usePathname();
  const { getProject } = useProjects();
  const segment = pathname.split("/")[3] || "overview";
  return <DashboardShell projectId={projectId} title={titles[segment] || "Proje Merkezi"} eyebrow={getProject(projectId)?.name || "Proje"}>{children}</DashboardShell>;
}
