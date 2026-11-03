import { describe, it } from "node:test";
import { getCompatibleRecipes, isRecipeCompatible } from "../../src/compat.js";
import { RECIPE_CATEGORIES } from "../../src/constants.js";
import { getRecipeCategories, getTemplate, recipes, templates } from "../../src/registry/index.js";
import type { RecipeConfig, TemplateConfig } from "../../src/types.js";
import { assertScaffoldInvariants, expectRejected, scaffold } from "../helpers/scaffold.js";

/**
 * Auto-generated coverage: every template × every recipe, plus each compatible
 * recipe inside a "full stack" (one exclusive pick per category + all extras).
 * A new template or recipe is covered here without writing a case.
 */

function fullStackWith(anchor: RecipeConfig, template: TemplateConfig): string[] {
  const picked: RecipeConfig[] = [anchor];
  const taken = new Set(anchor.exclusive ? getRecipeCategories(anchor) : []);

  for (const category of RECIPE_CATEGORIES) {
    if (taken.has(category)) continue;
    const choice = getCompatibleRecipes(template, category).find(
      (recipe) =>
        recipe.exclusive &&
        !recipe.default &&
        getRecipeCategories(recipe).every((c) => !taken.has(c)),
    );
    if (!choice) continue;
    picked.push(choice);
    for (const c of getRecipeCategories(choice)) taken.add(c);
  }

  for (const recipe of Object.values(recipes)) {
    if (!recipe.exclusive && !recipe.default && isRecipeCompatible(recipe, template)) {
      picked.push(recipe);
    }
  }

  return [...new Set(picked.map((recipe) => recipe.id))];
}

for (const templateId of Object.keys(templates)) {
  const template = getTemplate(templateId);
  if (!template) continue;

  describe(`matrix: ${templateId}`, () => {
    it(`${templateId}: base template (defaults only)`, async () => {
      assertScaffoldInvariants(await scaffold(templateId, []));
    });

    const stacks = new Set<string>();
    for (const recipe of Object.values(recipes)) {
      if (recipe.default) continue;

      if (!isRecipeCompatible(recipe, template)) {
        it(`${templateId}: rejects ${recipe.id}`, () => {
          expectRejected(templateId, [recipe.id]);
        });
        continue;
      }

      it(`${templateId} + ${recipe.id}`, async () => {
        assertScaffoldInvariants(await scaffold(templateId, [recipe.id]));
      });

      const stack = fullStackWith(recipe, template);
      const key = [...stack].sort().join(",");
      if (stack.length > 1 && !stacks.has(key)) {
        stacks.add(key);
        it(`${templateId} stack: ${stack.join(", ")}`, async () => {
          assertScaffoldInvariants(await scaffold(templateId, stack));
        });
      }
    }
  });
}
