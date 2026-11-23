import { Hono } from "hono";
import { CreateItemCommand } from "@/application/feature-a/commands/create-item.command.js";
import type { CreateItemHandler } from "@/application/feature-a/handlers/create-item.handler.js";
import { ItemResponseDto } from "./dto/item.response.dto.js";

type FeatureADeps = {
  createItemHandler: CreateItemHandler;
};

export function createFeatureAHttpRoutes(deps: FeatureADeps): Hono {
  const routes = new Hono({ strict: false });

  routes.post("/items", async (c) => {
    const body = (await c.req.json()) as { name?: string };
    const name = typeof body.name === "string" ? body.name : "";
    const result = await deps.createItemHandler.execute(new CreateItemCommand(name));
    return c.json(new ItemResponseDto(result.id, result.name), 201);
  });

  return routes;
}
