import type { TemplateConfig } from "@zealakit/core";

export const templateList: TemplateConfig[] = [
  {
    id: "stdlib-api",
    name: "Go Standard Library API",
    label: "Go Standard Library API",
    scope: "server",
    ecosystem: "go",
    description:
      "Minimal Go HTTP API using only the Standard Library (net/http, slog, graceful shutdown) with DDD-inspired layers",
    path: "go/stdlib-api",
    devCommand: "make run",
  },
  {
    id: "gin-api",
    name: "Gin + Go",
    label: "Gin + Go",
    scope: "server",
    ecosystem: "go",
    description:
      "Production-conscious REST API starter built with Gin, slog, and graceful shutdown",
    path: "go/gin-api",
    devCommand: "make run",
  },
  {
    id: "stdlib-worker",
    name: "Go Standard Library Worker",
    label: "Go Worker (stdlib, background processing)",
    scope: "infrastructure",
    ecosystem: "go",
    description:
      "Lightweight background worker built with Go Standard Library (ticker runner, slog, graceful shutdown)",
    path: "go/stdlib-worker",
    devCommand: "make run",
  },
];
