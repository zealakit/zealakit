import { useQuery } from "@tanstack/vue-query";

type Example = { id: string; name: string };

async function fetchExamples(): Promise<Example[]> {
  const response = await fetch("/api/examples");
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as Example[];
}

/** Example query: replace the key and `fetchExamples` with a real endpoint. */
export function useExamplesQuery() {
  return useQuery({ queryKey: ["examples"], queryFn: fetchExamples });
}
