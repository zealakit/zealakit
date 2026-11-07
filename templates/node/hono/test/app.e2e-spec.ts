import { createApp } from "../src/bootstrap/create-app.js";

describe("FeatureA (e2e)", () => {
  it("POST /api/v1/feature-a/items", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/feature-a/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Hexagonal Item" }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; name: string };
    expect(body).toMatchObject({ name: "Hexagonal Item" });
    expect(body.id).toEqual(expect.any(String));
  });
});

describe("FeatureB (e2e)", () => {
  it("GET /api/v1/feature-b/health with trailing slash", async () => {
    const app = createApp();
    const response = await app.request("/api/v1/feature-b/health/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
