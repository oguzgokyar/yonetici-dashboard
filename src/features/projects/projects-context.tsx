"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BrandConcept, emptyBrandConcept, normalizeBrandConcept } from "@/lib/brand-concept";

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
  brandConcept: BrandConcept;
};

type ProjectsContextValue = {
  projects: Project[];
  ready: boolean;
  createProject: (name: string) => Project;
  updateProject: (id: string, updates: Partial<Pick<Project, "name" | "brand" | "brandConcept">>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
};

const STORAGE_KEY = "yonetici-projects-v1";
const ProjectsContext = createContext<ProjectsContextValue | null>(null);

const emptyBrand: BrandProfile = {
  brandName: "",
  website: "",
  logo: "",
  phone: "",
  email: "",
  address: "",
  industry: "",
  description: "",
  audience: "",
  tone: "",
  primaryColor: "#6d5dfc",
  secondaryColor: "#171826",
  defaultCta: "Detaylı bilgi alın",
};

function normalizeProject(project: Project): Project {
  return {
    ...project,
    brand: { ...emptyBrand, ...project.brand },
    brandConcept: normalizeBrandConcept(project.brandConcept),
  };
}

function isMockProject(project: { id?: string; name?: string }): boolean {
  if (!project || !project.id) return false;
  const id = project.id.toLowerCase();
  return id === "nova-studio" || id === "atlas-coffee";
}

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // 1. Initial display from localStorage cache if available
      try {
        const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleanList = parsed.filter((p) => !isMockProject(p));
            if (!cancelled && cleanList.length > 0) {
              setProjects(cleanList.map(normalizeProject));
            }
          }
        }
      } catch {}

      // 2. Fetch authoritative data from server
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (response.ok) {
          const serverProjects = (await response.json()) as Project[];
          if (!cancelled && Array.isArray(serverProjects)) {
            const cleanServerList = serverProjects.filter((p) => !isMockProject(p));
            const normalized = cleanServerList.map(normalizeProject);
            setProjects(normalized);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            }
          }
        }
      } catch (err) {
        console.warn("[ProjectsContext] Failed to fetch server projects:", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects,
      ready,
      createProject(name) {
        const base = slugify(name) || "proje";
        let id = base;
        let count = 2;
        while (projects.some((project) => project.id === id)) id = `${base}-${count++}`;
        const newProject: Project = {
          id,
          name: name.trim(),
          createdAt: new Date().toISOString(),
          brand: emptyBrand,
          brandConcept: emptyBrandConcept,
        };
        const nextList = [newProject, ...projects];
        setProjects(nextList);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
        }

        // Persist to server
        fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: newProject }),
        }).catch((err) => {
          console.error("[ProjectsContext] Failed to persist new project:", err);
        });

        return newProject;
      },
      updateProject(id, updates) {
        let updatedTarget: Project | null = null;
        const nextList = projects.map((project) => {
          if (project.id === id) {
            updatedTarget = { ...project, ...updates };
            return updatedTarget;
          }
          return project;
        });

        setProjects(nextList);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
        }

        if (updatedTarget) {
          fetch("/api/projects", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project: updatedTarget }),
          }).catch((err) => {
            console.error("[ProjectsContext] Failed to persist updated project:", err);
          });
        }
      },
      deleteProject(id) {
        const nextList = projects.filter((project) => project.id !== id);
        setProjects(nextList);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
        }

        fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        }).catch((err) => {
          console.error("[ProjectsContext] Failed to delete project on server:", err);
        });
      },
      getProject(id) {
        return projects.find((project) => project.id === id);
      },
    }),
    [projects, ready]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const value = useContext(ProjectsContext);
  if (!value) throw new Error("useProjects must be used inside ProjectsProvider");
  return value;
}
