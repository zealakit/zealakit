import { appendEnvExample, defineRecipe } from "./define.js";

export default defineRecipe({
  id: "better-auth",
  discovery: { capabilities: ["auth"], projectTypes: ["ui", "server-api"] },
  name: "Better Auth",
  hint: "Email/password auth with route handler and client (in-memory until you add a database)",
  category: "auth",
  supportedScopes: ["hybrid", "server"],
  exclusive: true,
  packages: {
    "better-auth": "^1.7.25",
  },
  fileTransforms: {
    hono: [
      {
        file: "src/bootstrap/create-app.ts",
        pattern: /import \{ Hono \} from "hono";/,
        replacement:
          'import { Hono } from "hono";\nimport { auth } from "@/infrastructure/auth/auth.js";',
      },
      {
        file: "src/bootstrap/create-app.ts",
        pattern: /const app = new Hono\(\{ strict: false \}\);/,
        replacement:
          'const app = new Hono({ strict: false });\n\n  // Better Auth owns everything under /api/auth.\n  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));',
      },
    ],
  },
  finalize(targetDir) {
    appendEnvExample(
      targetDir,
      "BETTER_AUTH_SECRET",
      `# Better Auth
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000`,
    );
  },
});
