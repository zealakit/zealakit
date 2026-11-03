import type { TemplateConfig } from "../types.js";

export const templates: Record<string, TemplateConfig> = {
  "vite-react": {
    id: "vite-react",
    name: "Vite + React",
    scope: "client",
    description: "Minimal Vite + React + TypeScript starter",
    path: "vite-react",
  },
  "vite-vue": {
    id: "vite-vue",
    name: "Vite + Vue",
    scope: "client",
    description: "Minimal Vite + Vue + TypeScript starter",
    path: "vite-vue",
  },
  next: {
    id: "next",
    name: "Next.js",
    scope: "hybrid",
    description: "Next.js App Router + TypeScript starter",
    path: "next",
  },
  nuxt: {
    id: "nuxt",
    name: "Nuxt",
    scope: "hybrid",
    description: "Nuxt + TypeScript starter",
    path: "nuxt",
  },
  nest: {
    id: "nest",
    name: "NestJS",
    scope: "server",
    description: "NestJS + TypeScript hexagonal / DDD starter",
    path: "nest",
  },
  hono: {
    id: "hono",
    name: "Hono",
    scope: "server",
    description: "Hono + TypeScript hexagonal / DDD starter",
    path: "hono",
  },
};

export function getTemplate(id: string): TemplateConfig | undefined {
  return templates[id];
}

export function getAllTemplateIds(): string[] {
  return Object.keys(templates);
}

export function getTemplateScope(templateId: string): TemplateConfig["scope"] | undefined {
  return templates[templateId]?.scope;
}

/** Overlay folder name for recipe overlays under recipes/<recipe>/overlays. */
export function getTemplateOverlayId(templateId: string): string {
  const template = getTemplate(templateId);
  return template?.overlay ?? templateId;
}
