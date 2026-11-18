import "../register.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  applyAddPlan,
  getAllRecipes,
  getAllTemplates,
  isRecipeCompatible,
  planAddRecipes,
  scaffoldProject,
  withDefaultRecipes,
} from "@zealakit/core/internal";

/**
 * Safety net for `zealakit add`: adding a recipe to a pristine project must
 * give byte-for-byte the same tree as `create -w <recipe>` (modulo zealakit.json).
 */

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zealakit-add-equivalence-"));
after(() => fs.rmSync(workRoot, { recursive: true, force: true }));

let counter = 0;
const IGNORED = new Set(["zealakit.json"]);

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (dir: string, prefix: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) out[rel] = `-> ${fs.readlinkSync(full)}`;
      else if (entry.isDirectory()) visit(full, rel);
      else if (!IGNORED.has(rel)) out[rel] = fs.readFileSync(full).toString("base64");
    }
  };
  visit(root, "");
  return out;
}

for (const template of getAllTemplates()) {
  const recipes = getAllRecipes().filter(
    (recipe) => !recipe.default && isRecipeCompatible(recipe, template),
  );

  describe(`add equivalence: ${template.id}`, () => {
    for (const recipe of recipes) {
      it(`${recipe.id}`, async () => {
        const name = `eq-${++counter}`;
        // Recipes like goose/sqlc need one of several others (`requiresAnyOf`); the project already has it.
        const companion = recipe.requiresAnyOf?.[0];
        const baseRecipes = companion ? [companion] : [];
        const created = await scaffoldProject(
          {
            projectName: name,
            templateId: template.id,
            recipeIds: withDefaultRecipes(template.scope, [...baseRecipes, recipe.id]),
          },
          path.join(workRoot, "created"),
        );

        const base = await scaffoldProject(
          {
            projectName: name,
            templateId: template.id,
            recipeIds: withDefaultRecipes(template.scope, baseRecipes),
          },
          path.join(workRoot, "base"),
        );
        const plan = planAddRecipes(base, [recipe.id]);
        assert.deepEqual(plan.blockers, []);
        assert.deepEqual(
          plan.changes.filter((change) => change.kind === "conflict").map((c) => c.path),
          [],
        );
        applyAddPlan(plan);

        assert.deepEqual(snapshot(base), snapshot(created));
        assert.equal(fs.existsSync(path.join(base, ".zealakit")), false, "backup dir is removed");
      });
    }
  });
}
