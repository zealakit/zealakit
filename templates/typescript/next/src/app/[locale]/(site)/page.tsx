import { Suspense } from "react";
import { HeroBanner } from "./_components/hero-banner/server";
import { HeroBannerSkeleton } from "./_components/hero-banner/skeleton";
import { Solutions } from "./_components/solutions/client";
import { SolutionsSkeleton } from "./_components/solutions/skeleton";

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<HeroBannerSkeleton />}>
        <HeroBanner />
      </Suspense>
      <Suspense fallback={<SolutionsSkeleton />}>
        <Solutions />
      </Suspense>
    </>
  );
}
