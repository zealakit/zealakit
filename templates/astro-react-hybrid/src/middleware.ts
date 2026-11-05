import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const requestId = crypto.randomUUID();
  context.locals.requestId = requestId;

  const visitCount = (await context.session?.get("visitCount")) ?? 0;
  await context.session?.set("visitCount", visitCount + 1);

  const response = await next();
  response.headers.set("x-request-id", requestId);
  return response;
});
