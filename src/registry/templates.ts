import type { TemplateConfig } from "../types.js";

export const templates: Record<string, TemplateConfig> = {
  "vite-react": {
    id: "vite-react",
    name: "Vite + React",
    label: "Vite + React + TypeScript",
    scope: "client",
    framework: "react",
    description: "Minimal Vite + React + TypeScript starter",
    path: "vite-react",
  },
  "vite-vue": {
    id: "vite-vue",
    name: "Vite + Vue",
    label: "Vite + Vue + TypeScript",
    scope: "client",
    framework: "vue",
    description: "Minimal Vite + Vue + TypeScript starter",
    path: "vite-vue",
  },
  next: {
    id: "next",
    name: "Next.js",
    label: "Next.js App Router + TypeScript",
    scope: "hybrid",
    framework: "react",
    description: "Next.js App Router + TypeScript starter",
    path: "next",
  },
  nuxt: {
    id: "nuxt",
    name: "Nuxt",
    label: "Nuxt + TypeScript",
    scope: "hybrid",
    framework: "vue",
    description: "Nuxt + TypeScript starter",
    path: "nuxt",
    srcDir: "app",
  },
  nest: {
    id: "nest",
    name: "NestJS",
    label: "NestJS + TypeScript (DDD / hexagonal)",
    scope: "server",
    description: "NestJS + TypeScript hexagonal / DDD starter",
    path: "nest",
    devCommand: "npm run start:dev",
  },
  hono: {
    id: "hono",
    name: "Hono",
    label: "Hono + TypeScript (DDD / hexagonal)",
    scope: "server",
    description: "Hono + TypeScript hexagonal / DDD starter",
    path: "hono",
  },
};

export const DEFAULT_TEMPLATE_ID = "vite-react";

export function getTemplate(id: string): TemplateConfig | undefined {
  return templates[id];
}

export function getAllTemplateIds(): string[] {
  return Object.keys(templates);
}

/** Overlay folder name for recipe overlays under recipes/<recipe>/overlays. */
export function getTemplateOverlayId(templateId: string): string {
  const template = getTemplate(templateId);
  return template?.overlay ?? templateId;
}
