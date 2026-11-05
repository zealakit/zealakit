import type { TemplateConfig } from "@zealakit/core";

export const templateList: TemplateConfig[] = [
  {
    id: "stdlib-api",
    name: "Go stdlib API",
    label: "Go HTTP API (stdlib, DDD layers)",
    scope: "server",
    ecosystem: "go",
    description:
      "Minimal Go HTTP API using only the Standard Library (net/http, slog, graceful shutdown) with DDD-inspired layers",
    path: "go/stdlib-api",
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
