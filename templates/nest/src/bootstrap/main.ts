import { VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestNodeApplication, NodeAdapter } from "@nestjs/platform-node";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestNodeApplication>(
    AppModule,
    new NodeAdapter(),
  );
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
