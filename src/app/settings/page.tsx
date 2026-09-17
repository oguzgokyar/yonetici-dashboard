import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SettingsTabs } from "@/features/settings/settings-tabs";

export default function Page() {
  return (
    <DashboardShell title="Sistem Ayarları" eyebrow="Yönetim">
      <SettingsTabs />
    </DashboardShell>
  );
}
