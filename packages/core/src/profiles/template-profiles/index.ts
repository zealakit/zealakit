import type { TemplateProfile } from "../types.js";

/**
 * Discovery profiles for every registered template.
 * Keep `id` in sync with ecosystem template registries.
 */
export const TEMPLATE_PROFILES: readonly TemplateProfile[] = [
  {
    id: "vite-react",
    projectTypes: ["ui"],
    purposes: ["saas", "business", "internal-tool", "prototype", "learning"],
    frontendModes: ["spa"],
    delivery: "vite",
    capabilities: ["web-ui"],
    deploymentTargets: ["static-hosting"],
    architectureLevels: ["minimal"],
  },
  {
    id: "vite-vue",
    projectTypes: ["ui"],
    purposes: ["saas", "business", "internal-tool", "prototype", "learning"],
    frontendModes: ["spa"],
    delivery: "vite",
    capabilities: ["web-ui"],
    deploymentTargets: ["static-hosting"],
    architectureLevels: ["minimal"],
  },
  {
    id: "vite-svelte",
    projectTypes: ["ui"],
    purposes: ["saas", "business", "internal-tool", "prototype", "learning"],
    frontendModes: ["spa"],
    delivery: "vite",
    capabilities: ["web-ui"],
    deploymentTargets: ["static-hosting"],
    architectureLevels: ["minimal"],
  },
  {
    id: "astro-react-client",
    projectTypes: ["ui"],
    purposes: ["content-platform", "business", "prototype", "learning"],
    frontendModes: ["static", "ssg", "islands"],
    delivery: "astro",
    capabilities: ["web-ui"],
    deploymentTargets: ["static-hosting"],
    architectureLevels: ["minimal"],
  },
  {
    id: "astro-react-hybrid",
    projectTypes: ["ui"],
    purposes: ["content-platform", "saas", "business", "prototype"],
    frontendModes: ["ssr", "islands", "hybrid"],
    delivery: "astro",
    backend: {
      runtimes: ["node"],
    },
    capabilities: ["web-ui", "http-api"],
    deploymentTargets: ["container", "vps", "serverless"],
    architectureLevels: ["balanced"],
  },
  {
    id: "next",
    projectTypes: ["ui"],
    purposes: ["saas", "business", "ecommerce", "content-platform", "internal-tool", "prototype"],
    // App Router starter is SSR/SSG/hybrid — strong React web apps, not a classic Vite SPA.
    frontendModes: ["ssr", "ssg", "hybrid"],
    delivery: "next",
    backend: {
      runtimes: ["node"],
    },
    capabilities: ["web-ui", "http-api"],
    deploymentTargets: ["serverless", "container", "vps", "static-hosting"],
    architectureLevels: ["balanced"],
  },
  {
    id: "nuxt",
    projectTypes: ["ui"],
    purposes: ["saas", "business", "content-platform", "prototype", "internal-tool"],
    // Nuxt can run SPA mode, but the default starter is SSR/SSG/hybrid-oriented.
    frontendModes: ["ssr", "ssg", "hybrid", "spa"],
    delivery: "nuxt",
    backend: {
      runtimes: ["node"],
    },
    capabilities: ["web-ui", "http-api"],
    deploymentTargets: ["serverless", "container", "vps", "static-hosting"],
    architectureLevels: ["balanced"],
  },
  {
    id: "nest",
    projectTypes: ["server-api"],
    purposes: ["api-service", "saas", "business", "internal-tool"],
    backend: {
      runtimes: ["node"],
      frameworks: ["nest"],
    },
    capabilities: ["http-api"],
    deploymentTargets: ["container", "vps", "serverless"],
    architectureLevels: ["structured"],
    // Modular TS backend — strong for standard-to-busy APIs and complex domains.
    trafficExpectations: ["low", "medium", "high"],
  },
  {
    id: "hono",
    projectTypes: ["server-api"],
    purposes: ["api-service", "saas", "developer-tool", "prototype"],
    backend: {
      runtimes: ["node"],
      frameworks: ["hono"],
    },
    capabilities: ["http-api"],
    deploymentTargets: ["container", "vps", "serverless"],
    architectureLevels: ["balanced"],
    // Lightweight TS API — fine for ordinary and busy workloads; not a very-high specialist.
    trafficExpectations: ["low", "medium", "high"],
  },
  {
    id: "stdlib-api",
    projectTypes: ["server-api"],
    purposes: ["api-service", "developer-tool", "learning", "prototype"],
    backend: {
      runtimes: ["go"],
      frameworks: ["stdlib"],
    },
    capabilities: ["http-api"],
    deploymentTargets: ["container", "vps"],
    architectureLevels: ["structured", "minimal"],
    // Minimal Go net/http — direct lifecycle control suited to concurrent / critical loads.
    trafficExpectations: ["medium", "high", "very-high"],
  },
  {
    id: "gin-api",
    projectTypes: ["server-api"],
    purposes: ["api-service", "saas", "business", "developer-tool"],
    backend: {
      runtimes: ["go"],
      frameworks: ["gin"],
    },
    capabilities: ["http-api"],
    deploymentTargets: ["container", "vps"],
    architectureLevels: ["balanced"],
    // Go HTTP framework — strong soft fit for concurrent and performance-sensitive APIs.
    trafficExpectations: ["medium", "high", "very-high"],
  },
  {
    id: "stdlib-worker",
    projectTypes: ["background-worker"],
    purposes: ["api-service", "internal-tool", "developer-tool"],
    backend: {
      runtimes: ["go"],
      frameworks: ["stdlib"],
    },
    capabilities: ["background-processing"],
    deploymentTargets: ["container", "vps"],
    architectureLevels: ["minimal"],
  },
];
