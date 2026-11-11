import { EmbeddedToolView } from "@/features/developer-tools/embedded-tool-view";

export default function MeetingPage() {
  return (
    <EmbeddedToolView
      title="Toplantı Asistanı & Arşiv"
      eyebrow="Geliştirici Araçları"
      iframeSrc="https://teklif.43.131.47.253.sslip.io/meeting/"
      externalUrl="https://teklif.43.131.47.253.sslip.io/meeting/"
      description="Google Meet / Zoom toplantı ses kaydı, canlı transkript, Gemini toplantı özetleri."
    />
  );
}
