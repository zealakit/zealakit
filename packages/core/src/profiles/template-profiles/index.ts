import type { TemplateProfile } from "../types.js";

/**
 * Discovery profiles for every registered template.
 * Keep `id` in sync with ecosystem template registries.
 */
export const TEMPLATE_PROFILES: readonly TemplateProfile[] = [
  {
    id: "vite-react",
    projectTypes: ["web-app", "website"],
    purposes: ["saas", "business", "internal-tool", "prototype", "learning"],
    frontendModes: ["spa"],
    capabilities: ["web-ui"],
    deploymentTargets: ["static-hosting"],
    architectureLevels: ["minimal"],
  },
  {
    id: "vite-vue",
    projectTypes: ["web-app", "website"],
    purposes: ["saas", "business", "internal-tool", "prototype", "learning"],
    frontendModes: ["spa"],
    capabilities: ["web-ui"],
    deploymentTargets: ["static-hosting"],
    architectureLevels: ["minimal"],
  },
  {
    id: "astro-react-client",
    projectTypes: ["website"],
    purposes: ["content-platform", "business", "prototype", "learning"],
    frontendModes: ["static", "ssg", "islands"],
    capabilities: ["web-ui"],
    deploymentTargets: ["static-hosting"],
    architectureLevels: ["minimal"],
  },
  {
    id: "astro-react-hybrid",
    projectTypes: ["fullstack", "web-app", "website"],
    purposes: ["content-platform", "saas", "business", "prototype"],
    frontendModes: ["ssr", "islands"],
    backend: {
      runtimes: ["node"],
    },
    capabilities: ["web-ui", "http-api"],
    deploymentTargets: ["container", "vps", "serverless"],
    architectureLevels: ["balanced"],
  },
  {
    id: "next",
    projectTypes: ["fullstack", "web-app", "website"],
    purposes: ["saas", "business", "ecommerce", "content-platform", "prototype"],
    frontendModes: ["ssr", "ssg", "spa"],
    backend: {
      runtimes: ["node"],
    },
    capabilities: ["web-ui", "http-api"],
    deploymentTargets: ["serverless", "container", "vps", "static-hosting"],
    architectureLevels: ["balanced"],
  },
  {
    id: "nuxt",
    projectTypes: ["fullstack", "web-app", "website"],
    purposes: ["saas", "business", "content-platform", "prototype"],
    frontendModes: ["ssr", "ssg", "spa"],
    backend: {
      runtimes: ["node"],
    },
    capabilities: ["web-ui", "http-api"],
    deploymentTargets: ["serverless", "container", "vps", "static-hosting"],
    architectureLevels: ["balanced"],
  },
  {
    id: "nest",
    projectTypes: ["api"],
    purposes: ["api-service", "saas", "business", "internal-tool"],
    backend: {
      runtimes: ["node"],
      frameworks: ["nest"],
    },
    capabilities: ["http-api"],
    deploymentTargets: ["container", "vps", "serverless"],
    architectureLevels: ["structured"],
  },
  {
    id: "hono",
    projectTypes: ["api"],
    purposes: ["api-service", "saas", "developer-tool", "prototype"],
    backend: {
      runtimes: ["node"],
      frameworks: ["hono"],
    },
    capabilities: ["http-api"],
    deploymentTargets: ["container", "vps", "serverless"],
    architectureLevels: ["structured"],
  },
  {
    id: "stdlib-api",
    projectTypes: ["api"],
    purposes: ["api-service", "developer-tool", "learning", "prototype"],
    backend: {
      runtimes: ["go"],
      frameworks: ["stdlib"],
    },
    capabilities: ["http-api"],
    deploymentTargets: ["container", "vps"],
    architectureLevels: ["structured", "minimal"],
  },
  {
    id: "gin-api",
    projectTypes: ["api"],
    purposes: ["api-service", "saas", "business", "developer-tool"],
    backend: {
      runtimes: ["go"],
      frameworks: ["gin"],
    },
    capabilities: ["http-api"],
    deploymentTargets: ["container", "vps"],
    architectureLevels: ["balanced"],
  },
  {
    id: "stdlib-worker",
    projectTypes: ["worker"],
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
