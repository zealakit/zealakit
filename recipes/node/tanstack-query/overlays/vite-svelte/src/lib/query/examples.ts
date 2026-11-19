import { createQuery } from "@tanstack/svelte-query";

type Example = { id: string; name: string };

async function fetchExamples(): Promise<Example[]> {
  const response = await fetch("/api/examples");
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as Example[];
}

/** Example query: call inside a component, then read `$query.data` / `.isPending`. */
export function createExamplesQuery() {
  return createQuery(() => ({ queryKey: ["examples"], queryFn: fetchExamples }));
}
