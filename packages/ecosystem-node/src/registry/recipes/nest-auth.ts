import { appendEnvExample, defineRecipe } from "./define.js";

export default defineRecipe({
  id: "nest-auth",
  discovery: { capabilities: ["auth"], projectTypes: ["server-api"] },
  name: "Nest JWT auth",
  hint: "Login endpoint + bearer-token guard (@nestjs/jwt)",
  category: "auth",
  supportedScopes: ["server"],
  exclusive: true,
  packages: {
    "@nestjs/jwt": "^12.0.5",
    bcryptjs: "^3.0.3",
  },
  fileTransforms: {
    nest: [
      {
        file: "src/bootstrap/app.module.ts",
        pattern: /import \{ Module \} from "@nestjs\/common";/,
        replacement:
          'import { Module } from "@nestjs/common";\nimport { AuthModule } from "./modules/auth.module.js";',
      },
      {
        file: "src/bootstrap/app.module.ts",
        pattern: /imports: \[/,
        replacement: "imports: [AuthModule, ",
      },
    ],
  },
  finalize(targetDir) {
    appendEnvExample(
      targetDir,
      "JWT_SECRET",
      `# Auth (JWT)
JWT_SECRET=
DEMO_USER_EMAIL=demo@example.com
DEMO_USER_PASSWORD=change-me`,
    );
  },
});
