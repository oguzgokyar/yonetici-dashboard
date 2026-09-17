import type { Metadata } from "next";
import "./globals.css";
import { ProjectsProvider } from "@/features/projects/projects-context";

export const metadata: Metadata = {
  title: "Yönetici",
  description: "Markalar için içerik üretim ve dağıtım paneli",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        <ProjectsProvider>{children}</ProjectsProvider>
      </body>
    </html>
  );
}
