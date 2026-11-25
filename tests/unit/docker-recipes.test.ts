import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { scaffoldProject } from "@zealakit/core/internal";

import { composeFor } from "../../packages/ecosystem-go/src/registry/recipes/docker-go.js";
import { hasOrmRecipe } from "../../packages/ecosystem-node/src/registry/recipes/docker.js";

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-docker-test-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;
async function generate(templateId: string, recipeIds: string[]): Promise<string> {
  return scaffoldProject({ projectName: `docker-${++counter}`, templateId, recipeIds }, workRoot);
}

const read = (dir: string, file: string): string => fs.readFileSync(path.join(dir, file), "utf-8");

describe("docker (node)", () => {
  it("detects ORM recipes", () => {
    assert.equal(hasOrmRecipe(["biome", "prisma"]), true);
    assert.equal(hasOrmRecipe(["biome"]), false);
  });

  it("generates Dockerfile, .dockerignore and an app-only compose without an ORM", async () => {
    const dir = await generate("hono", ["docker"]);
    for (const file of ["Dockerfile", ".dockerignore", "compose.yaml"]) {
      assert.ok(fs.existsSync(path.join(dir, file)), file);
    }
    assert.doesNotMatch(read(dir, "compose.yaml"), /db:/);
  });

  it("adds a healthy Postgres db service and DATABASE_URL when an ORM is selected", async () => {
    const dir = await generate("hono", ["docker", "drizzle-orm"]);
    const compose = read(dir, "compose.yaml");
    assert.match(compose, /image: postgres:/);
    assert.match(compose, /DATABASE_URL: postgres:\/\/postgres:postgres@db:5432\/app/);
    assert.match(compose, /condition: service_healthy/);
  });

  it("switches Next to standalone output", async () => {
    const dir = await generate("next", ["docker"]);
    assert.match(read(dir, "next.config.ts"), /output: "standalone"/);
    assert.match(read(dir, "Dockerfile"), /\.next\/standalone/);
  });
});

describe("docker-go", () => {
  it("builds the right entrypoint per template", async () => {
    const api = await generate("stdlib-api", ["docker-go"]);
    assert.match(read(api, "Dockerfile"), /\.\/cmd\/api/);
    const worker = await generate("stdlib-worker", ["docker-go"]);
    assert.match(read(worker, "Dockerfile"), /\.\/cmd\/worker/);
    assert.doesNotMatch(read(worker, "compose.yaml"), /ports:/);
  });

  it("wires each database recipe", () => {
    assert.match(composeFor("stdlib-api", ["postgres"]), /image: postgres:/);
    assert.match(composeFor("gin-api", ["mysql"]), /image: mysql:8/);
    assert.match(composeFor("stdlib-api", ["mongodb"]), /MONGODB_URI: "mongodb:\/\/db:27017"/);
    assert.match(composeFor("gin-api", []), /APP_PORT: "8080"/);
    assert.doesNotMatch(composeFor("gin-api", []), /db:/);
  });

  it("scaffolds with a database recipe", async () => {
    const dir = await generate("stdlib-api", ["postgres", "docker-go"]);
    assert.match(read(dir, "compose.yaml"), /depends_on:/);
  });
});
