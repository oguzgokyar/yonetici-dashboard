import { EmbeddedToolView } from "@/features/developer-tools/embedded-tool-view";

export default function MeetingPage() {
  return (
    <EmbeddedToolView
      title="Toplantı Asistanı & Arşiv"
      eyebrow="Geliştirici Araçları"
      iframeSrc="http://43.131.47.253:8080/meeting/"
      externalUrl="http://43.131.47.253:8080/meeting/"
      description="Google Meet / Zoom toplantı ses kaydı, canlı transkript, Gemini toplantı özetleri."
    />
  );
}
