"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type BrandProfile = {
  brandName: string;
  website: string;
  logo: string;
  phone: string;
  email: string;
  address: string;
  industry: string;
  description: string;
  audience: string;
  tone: string;
  primaryColor: string;
  secondaryColor: string;
  defaultCta: string;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  brand: BrandProfile;
};

type ProjectsContextValue = {
  projects: Project[];
  ready: boolean;
  createProject: (name: string) => Project;
  updateProject: (id: string, updates: Partial<Pick<Project, "name" | "brand">>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
};

const STORAGE_KEY = "yonetici-projects-v1";
const ProjectsContext = createContext<ProjectsContextValue | null>(null);

const emptyBrand: BrandProfile = {
  brandName: "", website: "", logo: "", phone: "", email: "", address: "",
  industry: "", description: "", audience: "", tone: "", primaryColor: "#6d5dfc",
  secondaryColor: "#171826", defaultCta: "Detaylı bilgi alın",
};

function normalizeProject(project: Project): Project {
  return { ...project, brand: { ...emptyBrand, ...project.brand } };
}

const initialProjects: Project[] = [
  {
    id: "nova-studio",
    name: "Nova Studio",
    createdAt: "2026-09-16T09:00:00.000Z",
    brand: {
      brandName: "Nova Studio",
      website: "novastudio.co",
      logo: "",
      phone: "+90 212 555 24 10",
      email: "hello@novastudio.co",
      address: "İstanbul, Türkiye",
      industry: "Tasarım & Kreatif",
      description: "Dijital markalar için yaratıcı tasarım stüdyosu.",
      audience: "Büyüme odaklı girişimler ve modern markalar",
      tone: "Yalın, yaratıcı ve kendinden emin",
      primaryColor: "#6d5dfc",
      secondaryColor: "#171826",
      defaultCta: "Projenizi konuşalım",
    },
  },
  {
    id: "atlas-coffee",
    name: "Atlas Coffee",
    createdAt: "2026-09-12T09:00:00.000Z",
    brand: {
      brandName: "Atlas Coffee",
      website: "",
      logo: "",
      phone: "",
      email: "",
      address: "",
      industry: "Yeme & İçme",
      description: "",
      audience: "",
      tone: "",
      primaryColor: "#d97744",
      secondaryColor: "#38271f",
      defaultCta: "Menüyü keşfet",
    },
  },
];

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      let fallback = initialProjects;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) fallback = (JSON.parse(saved) as Project[]).map(normalizeProject);
        const response = await fetch("/api/projects", { cache: "no-store" });
        const serverProjects = response.ok ? await response.json() as Project[] : [];
        if (!cancelled) setProjects(serverProjects.length ? serverProjects.map(normalizeProject) : fallback);
      } catch { if (!cancelled) setProjects(fallback); }
      finally { if (!cancelled) setReady(true); }
    }
    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ready) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      fetch("/api/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projects }) }).catch(() => undefined);
    }
  }, [projects, ready]);

  const value = useMemo<ProjectsContextValue>(() => ({
    projects,
    ready,
    createProject(name) {
      const base = slugify(name) || "proje";
      let id = base;
      let count = 2;
      while (projects.some((project) => project.id === id)) id = `${base}-${count++}`;
      const project: Project = {
        id,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        brand: emptyBrand,
      };
      setProjects((current) => [project, ...current]);
      return project;
    },
    updateProject(id, updates) {
      setProjects((current) => current.map((project) => project.id === id ? { ...project, ...updates } : project));
    },
    deleteProject(id) {
      setProjects((current) => current.filter((project) => project.id !== id));
    },
    getProject(id) {
      return projects.find((project) => project.id === id);
    },
  }), [projects, ready]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const value = useContext(ProjectsContext);
  if (!value) throw new Error("useProjects must be used inside ProjectsProvider");
  return value;
}
