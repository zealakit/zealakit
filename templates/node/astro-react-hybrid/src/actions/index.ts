import { z } from "astro/zod";
import { defineAction } from "astro:actions";

export const server = {
  /** Demo action: validate input, persist a display name in the session, return it. */
  setDisplayName: defineAction({
    accept: "form",
    input: z.object({
      name: z.string().trim().min(1).max(64),
    }),
    handler: async ({ name }, context) => {
      await context.session?.set("displayName", name);
      return { name };
    },
  }),
};
