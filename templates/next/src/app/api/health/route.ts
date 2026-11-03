import { NextResponse } from "next/server";

/** Liveness probe — outside `[locale]`; excluded from next-intl via `proxy.ts` matcher. */
export function GET() {
  return NextResponse.json({
    ok: true,
    service: "next",
  });
}
