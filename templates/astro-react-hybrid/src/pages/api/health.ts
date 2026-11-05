export const prerender = false;

import type { APIRoute } from "astro";

/** Liveness probe — always on-demand so ops can hit a live Node process. */
export const GET: APIRoute = async ({ locals, session }) => {
  const visitCount = (await session?.get("visitCount")) ?? 0;

  return Response.json({
    ok: true,
    requestId: locals.requestId,
    visitCount,
    timestamp: new Date().toISOString(),
  });
};
