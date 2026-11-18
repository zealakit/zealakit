import type { TemplateConfig } from "@zealakit/core/ecosystem";

export const templateList: TemplateConfig[] = [
  {
    id: "stdlib-api",
    discovery: {
      projectTypes: ["server-api"],
      purposes: ["api-service", "developer-tool", "learning", "prototype"],
      backend: { runtimes: ["go"], frameworks: ["stdlib"] },
      capabilities: ["http-api"],
      deploymentTargets: ["container", "vps"],
      architectureLevels: ["structured", "minimal"],
      trafficExpectations: ["medium", "high", "very-high"],
    },
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
    discovery: {
      projectTypes: ["server-api"],
      purposes: ["api-service", "saas", "business", "developer-tool"],
      backend: { runtimes: ["go"], frameworks: ["gin"] },
      capabilities: ["http-api"],
      deploymentTargets: ["container", "vps"],
      architectureLevels: ["balanced"],
      trafficExpectations: ["medium", "high", "very-high"],
    },
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
    discovery: {
      projectTypes: ["background-worker"],
      purposes: ["api-service", "internal-tool", "developer-tool"],
      backend: { runtimes: ["go"], frameworks: ["stdlib"] },
      capabilities: ["background-processing"],
      deploymentTargets: ["container", "vps"],
      architectureLevels: ["minimal"],
    },
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
