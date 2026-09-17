import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AiProviders } from "@/features/settings/ai-providers";
import { SystemUpdates } from "@/features/settings/system-updates";

export default function Page() {
  return (
    <DashboardShell title="Sistem Ayarları" eyebrow="Yönetim">
      <AiProviders />
      <SystemUpdates />
    </DashboardShell>
  );
}
