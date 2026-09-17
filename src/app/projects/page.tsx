"use client";

import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProjectsPage } from "@/features/projects/projects-page";

export default function Page() {
  return <DashboardShell title="Projeler" eyebrow="Çalışma alanı"><Suspense><ProjectsPage /></Suspense></DashboardShell>;
}
