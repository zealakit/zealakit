import type { INestApplication } from "@nestjs/common";
import { VersioningType } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/bootstrap/app.module.js";

describe("FeatureA (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.setGlobalPrefix("api");
    await app.init();
  });

  it("POST /api/v1/feature-a/items", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/feature-a/items")
      .send({ name: "Hexagonal Item" })
      .expect(201);

    expect(response.body).toMatchObject({
      name: "Hexagonal Item",
    });
    expect(response.body.id).toEqual(expect.any(String));
  });

  afterEach(async () => {
    await app.close();
  });
});
